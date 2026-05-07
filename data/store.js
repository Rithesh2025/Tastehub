const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb');

// ─── DynamoDB Client Setup ────────────────────────────────────────────────────
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const db = DynamoDBDocumentClient.from(client);

const PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'tastehub';
const MENU_TABLE       = `${PREFIX}_menu`;
const INVENTORY_TABLE  = `${PREFIX}_inventory`;
const ORDERS_TABLE     = `${PREFIX}_orders`;
const COUNTER_TABLE    = `${PREFIX}_counters`;

// ─── Constants ────────────────────────────────────────────────────────────────
const MENU_CATEGORIES      = ['Starters', 'Mains', 'Breads', 'Rice & Biryani', 'Desserts', 'Drinks'];
const INVENTORY_CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Dry Goods', 'Beverages'];
const ORDER_STATUSES       = ['Pending', 'Preparing', 'Ready', 'Served'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
const newId  = () => crypto.randomUUID();

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateMenuInput(payload) {
  if (!payload || typeof payload !== 'object') throw httpError(400, 'Invalid menu payload');
  if (!payload.name || typeof payload.name !== 'string') throw httpError(400, 'name is required');
  if (typeof payload.price !== 'number' || payload.price < 0) throw httpError(400, 'price must be a non-negative number');
  if (!MENU_CATEGORIES.includes(payload.category)) throw httpError(400, 'Invalid category');

  return {
    name: payload.name.trim(),
    emoji: typeof payload.emoji === 'string' ? payload.emoji : '🍽️',
    price: payload.price,
    category: payload.category,
    desc: typeof payload.desc === 'string' ? payload.desc : '',
    popular: Boolean(payload.popular)
  };
}

function validateInventoryInput(payload) {
  if (!payload || typeof payload !== 'object') throw httpError(400, 'Invalid inventory payload');
  if (!payload.name || typeof payload.name !== 'string') throw httpError(400, 'name is required');
  if (!INVENTORY_CATEGORIES.includes(payload.category)) throw httpError(400, 'Invalid category');
  if (typeof payload.stock !== 'number' || payload.stock < 0) throw httpError(400, 'stock must be a non-negative number');
  if (typeof payload.low !== 'number' || payload.low < 0) throw httpError(400, 'low must be a non-negative number');
  if (!payload.unit || typeof payload.unit !== 'string') throw httpError(400, 'unit is required');

  return {
    name: payload.name.trim(),
    category: payload.category,
    stock: payload.stock,
    low: payload.low,
    unit: payload.unit.trim()
  };
}

function sanitizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'items must be a non-empty array');

  return items.map((item) => {
    if (!item || typeof item !== 'object') throw httpError(400, 'Invalid order item');
    if (!item.name || typeof item.name !== 'string') throw httpError(400, 'Each item must have a name');
    if (typeof item.price !== 'number' || item.price < 0) throw httpError(400, 'Each item must have a valid price');
    if (typeof item.qty !== 'number' || item.qty < 1) throw httpError(400, 'Each item must have qty >= 1');

    return {
      menuItemId: item.menuItemId || item.id || item._id || null,
      name: item.name,
      emoji: typeof item.emoji === 'string' ? item.emoji : '',
      price: item.price,
      qty: item.qty
    };
  });
}

function validateOrderInput(payload, orderNumber) {
  if (!payload || typeof payload !== 'object') throw httpError(400, 'Invalid order payload');
  if (!payload.table || typeof payload.table !== 'string') throw httpError(400, 'table is required');

  const status = payload.status || 'Pending';
  if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status');

  const items = sanitizeOrderItems(payload.items);
  const total = typeof payload.total === 'number'
    ? payload.total
    : items.reduce((sum, item) => sum + item.price * item.qty, 0);

  if (total < 0) throw httpError(400, 'total must be non-negative');

  return {
    orderNumber,
    table: payload.table,
    items,
    total,
    status,
    placedBy: payload.placedBy || 'admin',
    note: typeof payload.note === 'string' ? payload.note : ''
  };
}

// ─── DynamoDB Utilities ───────────────────────────────────────────────────────

// Scan all items from a table
async function scanAll(tableName) {
  const items = [];
  let lastKey;

  do {
    const params = { TableName: tableName };
    if (lastKey) params.ExclusiveStartKey = lastKey;

    const result = await db.send(new ScanCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// Get a single item by id, throws 404 if not found
async function getItemById(tableName, id, label) {
  const result = await db.send(new GetCommand({
    TableName: tableName,
    Key: { id }
  }));

  if (!result.Item) throw httpError(404, `${label} not found`);
  return result.Item;
}

// Get next order number using atomic counter in DynamoDB
async function getNextOrderNumber() {
  const result = await db.send(new UpdateCommand({
    TableName: COUNTER_TABLE,
    Key: { id: 'orderNumber' },
    UpdateExpression: 'SET #val = if_not_exists(#val, :start) + :inc',
    ExpressionAttributeNames: { '#val': 'value' },
    ExpressionAttributeValues: { ':start': 1000, ':inc': 1 },
    ReturnValues: 'UPDATED_NEW'
  }));

  return result.Attributes.value;
}

// ─── Store API ────────────────────────────────────────────────────────────────
module.exports = {
  httpError,

  getHealth() {
    return { ok: true, db: 'dynamodb' };
  },

  // ── Menu ──────────────────────────────────────────────────────────────────
  async listMenu() {
    const items = await scanAll(MENU_TABLE);
    return items.sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  },

  async getMenu(id) {
    return getItemById(MENU_TABLE, id, 'Menu item');
  },

  async createMenu(payload) {
    const timestamp = nowIso();
    const item = {
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...validateMenuInput(payload)
    };
    await db.send(new PutCommand({ TableName: MENU_TABLE, Item: item }));
    return item;
  },

  async updateMenu(id, payload) {
    const existing = await getItemById(MENU_TABLE, id, 'Menu item');
    const updated = {
      ...existing,
      ...validateMenuInput({ ...existing, ...payload }),
      updatedAt: nowIso()
    };
    await db.send(new PutCommand({ TableName: MENU_TABLE, Item: updated }));
    return updated;
  },

  async deleteMenu(id) {
    await getItemById(MENU_TABLE, id, 'Menu item');
    await db.send(new DeleteCommand({ TableName: MENU_TABLE, Key: { id } }));
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  async listInventory() {
    const items = await scanAll(INVENTORY_TABLE);
    return items.sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  },

  async listInventoryAlerts() {
    const items = await scanAll(INVENTORY_TABLE);
    return items
      .filter((item) => item.stock <= item.low)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  },

  async getInventory(id) {
    return getItemById(INVENTORY_TABLE, id, 'Inventory item');
  },

  async createInventory(payload) {
    const timestamp = nowIso();
    const item = {
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...validateInventoryInput(payload)
    };
    await db.send(new PutCommand({ TableName: INVENTORY_TABLE, Item: item }));
    return item;
  },

  async updateInventory(id, payload) {
    const existing = await getItemById(INVENTORY_TABLE, id, 'Inventory item');
    const updated = {
      ...existing,
      ...validateInventoryInput({ ...existing, ...payload }),
      updatedAt: nowIso()
    };
    await db.send(new PutCommand({ TableName: INVENTORY_TABLE, Item: updated }));
    return updated;
  },

  async restockInventory(id, qty) {
    if (typeof qty !== 'number' || qty <= 0) throw httpError(400, 'qty must be > 0');
    const existing = await getItemById(INVENTORY_TABLE, id, 'Inventory item');
    const updated = { ...existing, stock: existing.stock + qty, updatedAt: nowIso() };
    await db.send(new PutCommand({ TableName: INVENTORY_TABLE, Item: updated }));
    return updated;
  },

  async deleteInventory(id) {
    await getItemById(INVENTORY_TABLE, id, 'Inventory item');
    await db.send(new DeleteCommand({ TableName: INVENTORY_TABLE, Key: { id } }));
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  async listOrders(filters = {}) {
    let items = await scanAll(ORDERS_TABLE);

    if (filters.status) items = items.filter((o) => o.status === filters.status);
    if (filters.table)  items = items.filter((o) => o.table === filters.table);
    if (filters.active === 'true') items = items.filter((o) => o.status !== 'Served');

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getOrderStats() {
    const allOrders = await scanAll(ORDERS_TABLE);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayOrders  = allOrders.filter((o) => new Date(o.createdAt) >= startOfDay);
    const activeOrders = allOrders.filter((o) => o.status !== 'Served');
    const revenue      = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const activeTables = new Set(activeOrders.map((o) => o.table)).size;

    const dishCount = {};
    for (const order of todayOrders) {
      for (const item of order.items) {
        const key = item.menuItemId || item.name;
        if (!dishCount[key]) {
          dishCount[key] = { name: item.name, emoji: item.emoji, price: item.price, count: 0 };
        }
        dishCount[key].count += item.qty;
      }
    }

    const topDishes = Object.values(dishCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      revenue,
      totalOrders: todayOrders.length,
      activeTables,
      activeOrders: activeOrders.length,
      topDishes
    };
  },

  async getOrder(id) {
    return getItemById(ORDERS_TABLE, id, 'Order');
  },

  async createOrder(payload) {
    const orderNumber = await getNextOrderNumber();
    const timestamp = nowIso();
    const order = {
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...validateOrderInput(payload, orderNumber)
    };
    await db.send(new PutCommand({ TableName: ORDERS_TABLE, Item: order }));
    return order;
  },

  async updateOrderStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    const existing = await getItemById(ORDERS_TABLE, id, 'Order');
    const updated = { ...existing, status, updatedAt: nowIso() };
    await db.send(new PutCommand({ TableName: ORDERS_TABLE, Item: updated }));
    return updated;
  },

  async deleteOrder(id) {
    await getItemById(ORDERS_TABLE, id, 'Order');
    await db.send(new DeleteCommand({ TableName: ORDERS_TABLE, Key: { id } }));
  }
};
