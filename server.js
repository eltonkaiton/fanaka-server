import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import actorRoutes from "./routes/actorRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import playRoutes from "./routes/playRoutes.js";
import materialRequestRoutes from "./routes/materialRequests.js";
import orderRoutes from "./routes/orderRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Serve static files from uploads folder
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/actors", actorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/plays", playRoutes);
app.use("/api/material-requests", materialRequestRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/items", itemRoutes);

// Test Route
app.get("/", (req, res) => res.send("Fanaka Admin Backend Running"));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error("MongoDB connection error:", err));