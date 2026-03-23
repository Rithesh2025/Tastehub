// models.js — Mongoose schemas for TasteHub

const mongoose = require('mongoose');

// ─── MENU ───────────────────────────────────────────────────────────────────
const menuSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  emoji:    { type: String, default: '🍽️' },
  price:    { type: Number, required: true, min: 0 },
  category: {
    type: String,
    required: true,
    enum: ['Starters', 'Mains', 'Breads', 'Rice & Biryani', 'Desserts', 'Drinks']
  },
  desc:     { type: String, default: '' },
  popular:  { type: Boolean, default: false },
}, { timestamps: true });

// ─── INVENTORY ──────────────────────────────────────────────────────────────
const inventorySchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: ['Produce', 'Protein', 'Dairy', 'Dry Goods', 'Beverages']
  },
  stock:    { type: Number, required: true, min: 0, default: 0 },
  low:      { type: Number, required: true, min: 0, default: 5 },
  unit:     { type: String, required: true, default: 'kg' },
}, { timestamps: true });

// ─── ORDER ──────────────────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' },
  name:     { type: String, required: true },
  emoji:    { type: String },
  price:    { type: Number, required: true },
  qty:      { type: Number, required: true, min: 1 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: Number, required: true },
  table:    { type: String, required: true },
  items:    [orderItemSchema],
  total:    { type: Number, required: true },
  status:   {
    type: String,
    enum: ['Pending', 'Preparing', 'Ready', 'Served'],
    default: 'Pending'
  },
  placedBy: { type: String, default: 'admin' }, // 'admin' or 'user'
  note:     { type: String, default: '' },
}, { timestamps: true });

// Virtual: check if order is active
orderSchema.virtual('isActive').get(function () {
  return this.status !== 'Served';
});

module.exports = {
  Menu:      mongoose.model('Menu',      menuSchema),
  Inventory: mongoose.model('Inventory', inventorySchema),
  Order:     mongoose.model('Order',     orderSchema),
};
