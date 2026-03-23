// seed.js — Populate MongoDB with TasteHub's default menu & inventory data
require('dotenv').config();
const mongoose = require('mongoose');
const { Menu, Inventory, Order } = require('./models');

const MENU_DATA = [
  { name:"Paneer Tikka",      emoji:"🧀", price:260, category:"Starters",       desc:"Marinated cottage cheese cubes grilled in tandoor with spices", popular:true },
  { name:"Chicken 65",        emoji:"🍗", price:290, category:"Starters",       desc:"Crispy deep-fried chicken in fiery spices & curry leaves",      popular:true },
  { name:"Veg Spring Rolls",  emoji:"🥢", price:180, category:"Starters",       desc:"Crispy rolls stuffed with seasoned vegetables & glass noodles" },
  { name:"Seekh Kebab",       emoji:"🍢", price:320, category:"Starters",       desc:"Minced lamb kebabs with garam masala on iron skewers" },
  { name:"Mushroom Soup",     emoji:"🍜", price:150, category:"Starters",       desc:"Creamy button mushroom soup with herbs & cream swirl" },
  { name:"Butter Chicken",    emoji:"🍛", price:380, category:"Mains",          desc:"Tender chicken in rich tomato-butter-cream gravy",              popular:true },
  { name:"Palak Paneer",      emoji:"🥬", price:280, category:"Mains",          desc:"Fresh spinach purée cooked with cottage cheese & spices",       popular:true },
  { name:"Mutton Rogan Josh", emoji:"🥩", price:420, category:"Mains",          desc:"Slow-cooked Kashmiri lamb curry with aromatic whole spices" },
  { name:"Dal Makhani",       emoji:"🫘", price:220, category:"Mains",          desc:"Black lentils simmered overnight with butter & cream" },
  { name:"Veg Kadhai",        emoji:"🫑", price:240, category:"Mains",          desc:"Seasonal vegetables tossed in kadhai masala" },
  { name:"Fish Curry",        emoji:"🐟", price:360, category:"Mains",          desc:"Coastal-style fish in tangy coconut-tamarind gravy" },
  { name:"Butter Naan",       emoji:"🫓", price:60,  category:"Breads",         desc:"Fluffy tandoor-baked bread slathered with butter" },
  { name:"Garlic Roti",       emoji:"🫓", price:55,  category:"Breads",         desc:"Whole wheat roti with garlic & coriander butter" },
  { name:"Laccha Paratha",    emoji:"🫓", price:70,  category:"Breads",         desc:"Layered flaky whole wheat bread from tandoor" },
  { name:"Puri",              emoji:"🫓", price:50,  category:"Breads",         desc:"Deep-fried puffed bread served with curry" },
  { name:"Chicken Biryani",   emoji:"🍚", price:380, category:"Rice & Biryani", desc:"Fragrant basmati rice slow-cooked with spiced chicken",         popular:true },
  { name:"Veg Biryani",       emoji:"🍚", price:280, category:"Rice & Biryani", desc:"Aromatic basmati with seasonal vegetables & saffron" },
  { name:"Egg Fried Rice",    emoji:"🍳", price:200, category:"Rice & Biryani", desc:"Wok-tossed rice with eggs, vegetables & soy sauce" },
  { name:"Jeera Rice",        emoji:"🍚", price:150, category:"Rice & Biryani", desc:"Basmati rice tempered with cumin & ghee" },
  { name:"Gulab Jamun",       emoji:"🍮", price:120, category:"Desserts",       desc:"Soft milk-solid dumplings soaked in rose sugar syrup" },
  { name:"Kulfi Falooda",     emoji:"🍨", price:160, category:"Desserts",       desc:"Indian ice cream with vermicelli, basil seeds & rose milk",     popular:true },
  { name:"Rasgulla",          emoji:"🍡", price:110, category:"Desserts",       desc:"Light spongy cottage cheese balls in sugar syrup" },
  { name:"Phirni",            emoji:"🥣", price:130, category:"Desserts",       desc:"Chilled ground rice pudding with cardamom & pistachios" },
  { name:"Mango Lassi",       emoji:"🥭", price:110, category:"Drinks",         desc:"Thick chilled yoghurt drink blended with Alphonso mango",       popular:true },
  { name:"Masala Chai",       emoji:"☕", price:60,  category:"Drinks",         desc:"Spiced Indian tea brewed with ginger, cardamom & milk" },
  { name:"Fresh Lime Soda",   emoji:"🍋", price:80,  category:"Drinks",         desc:"Freshly squeezed lime with sparkling water & mint" },
  { name:"Watermelon Juice",  emoji:"🍉", price:90,  category:"Drinks",         desc:"Fresh cold-pressed watermelon with a hint of black salt" },
];

const INVENTORY_DATA = [
  { name:"Onions",           category:"Produce",   stock:18,  low:10, unit:"kg" },
  { name:"Tomatoes",         category:"Produce",   stock:12,  low:8,  unit:"kg" },
  { name:"Spinach",          category:"Produce",   stock:4,   low:5,  unit:"kg" },
  { name:"Garlic",           category:"Produce",   stock:3,   low:4,  unit:"kg" },
  { name:"Ginger",           category:"Produce",   stock:2,   low:3,  unit:"kg" },
  { name:"Bell Peppers",     category:"Produce",   stock:8,   low:5,  unit:"kg" },
  { name:"Chicken",          category:"Protein",   stock:22,  low:10, unit:"kg" },
  { name:"Mutton",           category:"Protein",   stock:8,   low:6,  unit:"kg" },
  { name:"Fish",             category:"Protein",   stock:5,   low:6,  unit:"kg" },
  { name:"Paneer",           category:"Protein",   stock:15,  low:8,  unit:"kg" },
  { name:"Eggs",             category:"Protein",   stock:60,  low:30, unit:"pcs" },
  { name:"Butter",           category:"Dairy",     stock:6,   low:5,  unit:"kg" },
  { name:"Cream",            category:"Dairy",     stock:3,   low:4,  unit:"L" },
  { name:"Yoghurt / Curd",   category:"Dairy",     stock:10,  low:6,  unit:"kg" },
  { name:"Milk",             category:"Dairy",     stock:20,  low:10, unit:"L" },
  { name:"Basmati Rice",     category:"Dry Goods", stock:30,  low:15, unit:"kg" },
  { name:"Wheat Flour",      category:"Dry Goods", stock:25,  low:10, unit:"kg" },
  { name:"Lentils (Dal)",    category:"Dry Goods", stock:18,  low:8,  unit:"kg" },
  { name:"Cooking Oil",      category:"Dry Goods", stock:8,   low:5,  unit:"L" },
  { name:"Garam Masala",     category:"Dry Goods", stock:1.5, low:2,  unit:"kg" },
  { name:"Mango Pulp",       category:"Beverages", stock:10,  low:8,  unit:"L" },
  { name:"Tea Leaves",       category:"Beverages", stock:2,   low:2,  unit:"kg" },
  { name:"Watermelon",       category:"Beverages", stock:6,   low:4,  unit:"pcs" },
  { name:"Lime",             category:"Beverages", stock:3,   low:5,  unit:"kg" },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([Menu.deleteMany({}), Inventory.deleteMany({}), Order.deleteMany({})]);
  console.log('Cleared existing data');

  // Insert fresh data
  const menuItems = await Menu.insertMany(MENU_DATA);
  const invItems  = await Inventory.insertMany(INVENTORY_DATA);

  console.log(`✅ Seeded ${menuItems.length} menu items`);
  console.log(`✅ Seeded ${invItems.length} inventory items`);
  console.log('🌱 Seed complete!');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
