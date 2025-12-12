import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  item: { type: String, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, default: "Pending" },
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
