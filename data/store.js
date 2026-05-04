const crypto = require('crypto');
const { MENU_DATA, INVENTORY_DATA } = require('./defaultData');

const MENU_CATEGORIES = ['Starters', 'Mains', 'Breads', 'Rice & Biryani', 'Desserts', 'Drinks'];
const INVENTORY_CATEGORIES = ['Produce', 'Protein', 'Dairy', 'Dry Goods', 'Beverages'];
const ORDER_STATUSES = ['Pending', 'Preparing', 'Ready', 'Served'];

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateMenuInput(payload) {
  if (!payload || typeof payload !== 'object') throw httpError(400, 'Invalid menu payload');
  if (!payload.name || typeof payload.name !== 'string') throw httpError(400, 'name is required');
  if (typeof payload.price !== 'number' || payload.price < 0) throw httpError(400, 'price must be a non-negative number');
  if (!MENU_CATEGORIES.includes(payload.category)) throw httpError(400, 'Invalid category');

  return {
    name: payload.name.trim(),
    emoji: typeof payload.emoji === 'string' ? payload.emoji : '\ud83c\udf7d\ufe0f',
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
    : items.reduce((sum, item) => sum + (item.price * item.qty), 0);

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

function sortBy(fields) {
  return (a, b) => {
    for (const field of fields) {
      const left = a[field];
      const right = b[field];
      if (left === right) continue;
      if (left == null) return 1;
      if (right == null) return -1;
      return left < right ? -1 : 1;
    }
    return 0;
  };
}

let menu = [];
let inventory = [];
let orders = [];
let nextOrderNumber = 1001;

function withMeta(record) {
  const timestamp = nowIso();
  return { id: newId(), createdAt: timestamp, updatedAt: timestamp, ...record };
}

function reset() {
  menu = MENU_DATA.map((item) => withMeta(validateMenuInput(item)));
  inventory = INVENTORY_DATA.map((item) => withMeta(validateInventoryInput(item)));
  orders = [];
  nextOrderNumber = 1001;
}

reset();

function getById(collection, id, label) {
  const item = collection.find((entry) => entry.id === id);
  if (!item) throw httpError(404, `${label} not found`);
  return item;
}

module.exports = {
  reset,
  getHealth() {
    return { ok: true, db: 'local-memory' };
  },
  listMenu() {
    return clone(menu).sort(sortBy(['category', 'name']));
  },
  getMenu(id) {
    return clone(getById(menu, id, 'Menu item'));
  },
  createMenu(payload) {
    const item = withMeta(validateMenuInput(payload));
    menu.push(item);
    return clone(item);
  },
  updateMenu(id, payload) {
    const existing = getById(menu, id, 'Menu item');
    const updated = { ...existing, ...validateMenuInput({ ...existing, ...payload }), updatedAt: nowIso() };
    menu = menu.map((item) => item.id === id ? updated : item);
    return clone(updated);
  },
  deleteMenu(id) {
    getById(menu, id, 'Menu item');
    menu = menu.filter((item) => item.id !== id);
  },
  listInventory() {
    return clone(inventory).sort(sortBy(['category', 'name']));
  },
  listInventoryAlerts() {
    return clone(inventory.filter((item) => item.stock <= item.low)).sort(sortBy(['category', 'name']));
  },
  getInventory(id) {
    return clone(getById(inventory, id, 'Inventory item'));
  },
  createInventory(payload) {
    const item = withMeta(validateInventoryInput(payload));
    inventory.push(item);
    return clone(item);
  },
  updateInventory(id, payload) {
    const existing = getById(inventory, id, 'Inventory item');
    const updated = { ...existing, ...validateInventoryInput({ ...existing, ...payload }), updatedAt: nowIso() };
    inventory = inventory.map((item) => item.id === id ? updated : item);
    return clone(updated);
  },
  restockInventory(id, qty) {
    if (typeof qty !== 'number' || qty <= 0) throw httpError(400, 'qty must be > 0');
    const existing = getById(inventory, id, 'Inventory item');
    const updated = { ...existing, stock: existing.stock + qty, updatedAt: nowIso() };
    inventory = inventory.map((item) => item.id === id ? updated : item);
    return clone(updated);
  },
  deleteInventory(id) {
    getById(inventory, id, 'Inventory item');
    inventory = inventory.filter((item) => item.id !== id);
  },
  listOrders(filters = {}) {
    let filtered = [...orders];
    if (filters.status) filtered = filtered.filter((order) => order.status === filters.status);
    if (filters.table) filtered = filtered.filter((order) => order.table === filters.table);
    if (filters.active === 'true') filtered = filtered.filter((order) => order.status !== 'Served');
    return clone(filtered).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getOrderStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter((order) => new Date(order.createdAt) >= startOfDay);
    const activeOrders = orders.filter((order) => order.status !== 'Served');
    const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const activeTables = new Set(activeOrders.map((order) => order.table)).size;

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
  getOrder(id) {
    return clone(getById(orders, id, 'Order'));
  },
  createOrder(payload) {
    const order = withMeta(validateOrderInput(payload, nextOrderNumber++));
    orders.push(order);
    return clone(order);
  },
  updateOrderStatus(id, status) {
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, 'Invalid status');
    const existing = getById(orders, id, 'Order');
    const updated = { ...existing, status, updatedAt: nowIso() };
    orders = orders.map((order) => order.id === id ? updated : order);
    return clone(updated);
  },
  deleteOrder(id) {
    getById(orders, id, 'Order');
    orders = orders.filter((order) => order.id !== id);
  },
  httpError
};
