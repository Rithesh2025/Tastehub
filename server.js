// server.js — TasteHub Express + MongoDB Backend
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const { Menu, Inventory, Order } = require('./models');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves the tastehub HTML

// ─── DB CONNECTION ───────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected:', process.env.MONGODB_URI))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// Clean up legacy unique index on "id" that causes E11000 when id is null
mongoose.connection.once('open', async () => {
  try {
    const indexes = await mongoose.connection.db.collection('orders').indexes();
    const hasBadIndex = indexes.find(i => i.name === 'id_1' && i.unique);
    if (hasBadIndex) {
      await mongoose.connection.db.collection('orders').dropIndex('id_1');
      console.log('🧹 Dropped legacy unique index id_1 on orders');
    }
  } catch (e) {
    console.warn('Index cleanup skipped:', e.message);
  }

  // Fallback: drop any other custom indexes on orders except _id
  try {
    const idx = await mongoose.connection.db.collection('orders').indexes();
    const extra = idx.filter(i => i.name !== '_id_');
    if (extra.length) {
      await mongoose.connection.db.collection('orders').dropIndexes();
      console.log('🧹 Dropped all non-_id indexes on orders');
    }
  } catch (e) {
    console.warn('Index cleanup skipped:', e.message);
  }
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, db: mongoose.connection.readyState }));

// ════════════════════════════════════════════════════════════════════════════
//  MENU ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET  /api/menu          — list all menu items
app.get('/api/menu', async (req, res) => {
  try {
    const items = await Menu.find().sort({ category: 1, name: 1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/menu/:id      — get single item
app.get('/api/menu/:id', async (req, res) => {
  try {
    const item = await Menu.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/menu          — create a new dish
app.post('/api/menu', async (req, res) => {
  try {
    const item = await Menu.create(req.body);
    res.status(201).json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/menu/:id      — update a dish
app.put('/api/menu/:id', async (req, res) => {
  try {
    const item = await Menu.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/menu/:id    — remove a dish
app.delete('/api/menu/:id', async (req, res) => {
  try {
    const item = await Menu.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  INVENTORY ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET  /api/inventory          — list all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ category: 1, name: 1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/inventory/alerts   — items at or below low-stock threshold
app.get('/api/inventory/alerts', async (req, res) => {
  try {
    const items = await Inventory.find({ $expr: { $lte: ['$stock', '$low'] } });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/inventory/:id
app.get('/api/inventory/:id', async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/inventory          — add new item
app.post('/api/inventory', async (req, res) => {
  try {
    const item = await Inventory.create(req.body);
    res.status(201).json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT  /api/inventory/:id      — edit item
app.put('/api/inventory/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/inventory/:id/restock  — add stock quantity
app.patch('/api/inventory/:id/restock', async (req, res) => {
  try {
    const { qty } = req.body;
    if (!qty || qty <= 0) return res.status(400).json({ error: 'qty must be > 0' });
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: qty } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/inventory/:id
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  ORDER ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET  /api/orders              — list all orders (optionally filter by status/table)
app.get('/api/orders', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.table)  filter.table  = req.query.table;
    if (req.query.active === 'true') filter.status = { $ne: 'Served' };
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/orders/stats        — today's summary stats
app.get('/api/orders/stats', async (req, res) => {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const [todayOrders, activeOrders] = await Promise.all([
      Order.find({ createdAt: { $gte: startOfDay } }),
      Order.find({ status: { $ne: 'Served' } }),
    ]);
    const revenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const activeTables = new Set(activeOrders.map(o => o.table)).size;

    // Top dishes today
    const dishCount = {};
    todayOrders.forEach(o => o.items.forEach(i => {
      const key = i.menuItemId?.toString() || i.name;
      if (!dishCount[key]) dishCount[key] = { name: i.name, emoji: i.emoji, price: i.price, count: 0 };
      dishCount[key].count += i.qty;
    }));
    const topDishes = Object.values(dishCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.json({ revenue, totalOrders: todayOrders.length, activeTables, activeOrders: activeOrders.length, topDishes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET  /api/orders/:id
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/orders              — place a new order
app.post('/api/orders', async (req, res) => {
  try {
    // Auto-generate order number
    const last = await Order.findOne().sort({ orderNumber: -1 });
    const orderNumber = (last?.orderNumber || 1000) + 1;

    // Sanitize payload to avoid duplicate key on id/null and enforce shape
    const items = (req.body.items || []).map(it => ({
      menuItemId: it.menuItemId || it.id || it._id,
      name: it.name,
      emoji: it.emoji,
      price: it.price,
      qty: it.qty,
    }));
    const order = await Order.create({
      // ensure no stray "id" field
      table: req.body.table,
      placedBy: req.body.placedBy || 'admin',
      status: req.body.status || 'Pending',
      items,
      total: req.body.total,
      orderNumber,
      note: req.body.note || '',
    });

    // Consume inventory based on order items (optional — expand MAP as needed)
    const CONSUMPTION_MAP = {
      // menuItemName -> [inventoryItemName, amtPerServing]
      // This uses names for portability; feel free to switch to IDs after seeding
    };

    res.status(201).json(order);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/orders/:id/status  — update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Preparing', 'Ready', 'Served'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/orders/:id
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 TasteHub API running at http://localhost:${PORT}`);
  console.log(`   Endpoints: /api/menu  /api/inventory  /api/orders`);
});
