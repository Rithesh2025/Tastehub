require('dotenv').config();

const express = require('express');
const cors = require('cors');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const handleError = (res, error) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Internal server error' });
};

// Root route — serve the HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/Tastehub.html');
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json(store.getHealth()));

// ── Menu ──────────────────────────────────────────────────────────────────────
app.get('/api/menu', async (_, res) => {
  try {
    res.json(await store.listMenu());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/menu/:id', async (req, res) => {
  try {
    res.json(await store.getMenu(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/menu', async (req, res) => {
  try {
    res.status(201).json(await store.createMenu(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/menu/:id', async (req, res) => {
  try {
    res.json(await store.updateMenu(req.params.id, req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    await store.deleteMenu(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Inventory ─────────────────────────────────────────────────────────────────
app.get('/api/inventory', async (_, res) => {
  try {
    res.json(await store.listInventory());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inventory/alerts', async (_, res) => {
  try {
    res.json(await store.listInventoryAlerts());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    res.json(await store.getInventory(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    res.status(201).json(await store.createInventory(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    res.json(await store.updateInventory(req.params.id, req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.patch('/api/inventory/:id/restock', async (req, res) => {
  try {
    res.json(await store.restockInventory(req.params.id, req.body.qty));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    await store.deleteInventory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Orders ────────────────────────────────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  try {
    res.json(await store.listOrders(req.query));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/orders/stats', async (_, res) => {
  try {
    res.json(await store.getOrderStats());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    res.json(await store.getOrder(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    res.status(201).json(await store.createOrder(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    res.json(await store.updateOrderStatus(req.params.id, req.body.status));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    await store.deleteOrder(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`TasteHub API running at http://localhost:${PORT}`);
  console.log(`Region: ${process.env.AWS_REGION}`);
  console.log(`DynamoDB Table Prefix: ${process.env.DYNAMODB_TABLE_PREFIX}`);
});
