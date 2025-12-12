import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const actorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  stageName: { type: String },
  role: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

// Encrypt password before saving
actorSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const Actor = mongoose.model("Actor", actorSchema);
export default Actor;
