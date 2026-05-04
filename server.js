require('dotenv').config();

const express = require('express');
const cors = require('cors');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const handleError = (res, error) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'Internal server error' });
};

app.get('/api/health', (_, res) => res.json(store.getHealth()));

app.get('/api/menu', async (_, res) => {
  try {
    res.json(store.listMenu());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/menu/:id', async (req, res) => {
  try {
    res.json(store.getMenu(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/menu', async (req, res) => {
  try {
    res.status(201).json(store.createMenu(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/menu/:id', async (req, res) => {
  try {
    res.json(store.updateMenu(req.params.id, req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    store.deleteMenu(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inventory', async (_, res) => {
  try {
    res.json(store.listInventory());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inventory/alerts', async (_, res) => {
  try {
    res.json(store.listInventoryAlerts());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inventory/:id', async (req, res) => {
  try {
    res.json(store.getInventory(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    res.status(201).json(store.createInventory(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    res.json(store.updateInventory(req.params.id, req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.patch('/api/inventory/:id/restock', async (req, res) => {
  try {
    res.json(store.restockInventory(req.params.id, req.body.qty));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    store.deleteInventory(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    res.json(store.listOrders(req.query));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/orders/stats', async (_, res) => {
  try {
    res.json(store.getOrderStats());
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    res.json(store.getOrder(req.params.id));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    res.status(201).json(store.createOrder(req.body));
  } catch (error) {
    handleError(res, error);
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    res.json(store.updateOrderStatus(req.params.id, req.body.status));
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    store.deleteOrder(req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`TasteHub API running at http://localhost:${PORT}`);
  console.log('Storage mode: local in-memory store');
  console.log('Next step: replace data/store.js with a DynamoDB-backed implementation');
});
