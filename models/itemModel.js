import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  lowStockThreshold: { type: Number, required: true },
}, { timestamps: true });

const Item = mongoose.model("Item", itemSchema);

export default Item;
