// models/Play.js
import mongoose from "mongoose";

const playSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  image: { type: String, default: "" }, // stores relative path: e.g., "uploads/abc123.jpg"
  createdAt: { type: Date, default: Date.now },

  // List of actors assigned to the play
  actors: [
    {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "Actor", required: true },
      role: { type: String, required: true },
      status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
      confirmed: { type: Boolean, default: false } // Actor confirms availability
    }
  ],

  // Material requests by actors
  materialRequests: [
    {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "Actor", required: true },
      materials: { type: [String], required: true }, // Array of requested materials
      requestedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" }
    }
  ]
});

// Optional: virtual field to get full image URL if needed
playSchema.virtual("imageUrl").get(function () {
  if (!this.image) return null;
  return `${process.env.SERVER_URL || "http://localhost:5000"}/${this.image}`;
});

const Play = mongoose.model("Play", playSchema);
export default Play;
