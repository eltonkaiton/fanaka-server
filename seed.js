import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define your Item schema
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: "pcs" },
  lowStockThreshold: { type: Number, default: 5 },
});

const Item = mongoose.model("Item", itemSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("MongoDB connected for seeding...");
    seedItems();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Array of Fanaka Arts inventory items
const items = [
  { name: "Stage Lights", category: "Equipment", quantity: 20, unit: "pcs", lowStockThreshold: 5 },
  { name: "Microphones", category: "Equipment", quantity: 15, unit: "pcs", lowStockThreshold: 3 },
  { name: "Speakers", category: "Equipment", quantity: 10, unit: "pcs", lowStockThreshold: 2 },
  { name: "Sound Mixer", category: "Equipment", quantity: 5, unit: "pcs", lowStockThreshold: 1 },
  { name: "Costumes – Male", category: "Costumes", quantity: 50, unit: "pcs", lowStockThreshold: 10 },
  { name: "Costumes – Female", category: "Costumes", quantity: 50, unit: "pcs", lowStockThreshold: 10 },
  { name: "Props – Chairs", category: "Props", quantity: 30, unit: "pcs", lowStockThreshold: 5 },
  { name: "Props – Tables", category: "Props", quantity: 15, unit: "pcs", lowStockThreshold: 3 },
  { name: "Props – Lanterns", category: "Props", quantity: 20, unit: "pcs", lowStockThreshold: 5 },
  { name: "Script Copies", category: "Materials", quantity: 100, unit: "pcs", lowStockThreshold: 20 },
  { name: "Notebooks", category: "Materials", quantity: 50, unit: "pcs", lowStockThreshold: 10 },
  { name: "Markers", category: "Materials", quantity: 30, unit: "pcs", lowStockThreshold: 5 },
  { name: "Paint Brushes", category: "Materials", quantity: 25, unit: "pcs", lowStockThreshold: 5 },
  { name: "Stage Curtains", category: "Equipment", quantity: 5, unit: "pcs", lowStockThreshold: 1 },
  { name: "Makeup Kits", category: "Costumes", quantity: 20, unit: "kits", lowStockThreshold: 5 },
  { name: "Hair Wigs", category: "Costumes", quantity: 15, unit: "pcs", lowStockThreshold: 3 },
];

// Seed function
const seedItems = async () => {
  try {
    await Item.deleteMany(); // Clear existing items
    await Item.insertMany(items);
    console.log("Fanaka Arts items seeded successfully!");
    mongoose.connection.close();
  } catch (err) {
    console.error("Seeding error:", err);
  }
};
