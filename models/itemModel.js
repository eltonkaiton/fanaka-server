// models/itemModel.js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: ["Electronics", "Furniture", "Stationery", "Costumes", "Cleaning", "Food", "Beverages", "Office", "Medical", "Equipment", "Other"],
    default: "Other"
  },
  currentStock: { 
    type: Number, 
    required: true,
    default: 0,
    min: 0
  },
  unit: { 
    type: String, 
    required: true,
    default: "pcs"
  },
  lowStockThreshold: { 
    type: Number, 
    required: true,
    default: 10,
    min: 0
  },
  minStockLevel: {
    type: Number,
    default: 5,
    min: 0
  },
  maxStockLevel: {
    type: Number,
    default: 100,
    min: 0
  },
  reorderPoint: {
    type: Number,
    default: 20,
    min: 0
  },
  unitCost: {
    type: Number,
    default: 0,
    min: 0
  },
  sellingPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  location: {
    type: String,
    trim: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  },
  supplierName: {
    type: String
  },
  lastRestocked: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String
  }
}, { 
  timestamps: true 
});

// Virtual to check if stock is low
itemSchema.virtual("isLowStock").get(function() {
  return this.currentStock <= this.lowStockThreshold;
});

// Virtual to check if stock is critical
itemSchema.virtual("isCriticalStock").get(function() {
  return this.currentStock <= this.minStockLevel;
});

// Method to add stock
itemSchema.methods.addStock = async function(quantity) {
  this.currentStock += quantity;
  this.lastRestocked = new Date();
  return this.save();
};

// Method to remove stock
itemSchema.methods.removeStock = async function(quantity) {
  if (this.currentStock < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.currentStock}, Requested: ${quantity}`);
  }
  this.currentStock -= quantity;
  return this.save();
};

// Method to update stock
itemSchema.methods.updateStock = async function(newQuantity) {
  if (newQuantity < 0) {
    throw new Error("Stock cannot be negative");
  }
  this.currentStock = newQuantity;
  return this.save();
};

// Index for better query performance
itemSchema.index({ category: 1 });
itemSchema.index({ isLowStock: 1 });
itemSchema.index({ name: "text", description: "text" });

const Item = mongoose.model("Item", itemSchema);

export default Item;