import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

// 🔥 REGISTER MODELS (VERY IMPORTANT)
import "./models/User.js";
import "./models/Employee.js";
import "./models/ChatMessage.js";
import "./models/Actor.js";
import "./models/Play.js";
import "./models/Inventory.js";
import "./models/MaterialRequest.js";
import "./models/Order.js";
import "./models/itemModel.js";
import "./models/Booking.js";
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
import bookingRoutes from "./routes/bookingRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
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
app.use("/api/bookings", bookingRoutes);

// HTTP server + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH"] }
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log("👤 User joined room:", userId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// Chat routes with Socket.IO
app.use("/api/chat", chatRoutes(io));

// Test route
app.get("/", (req, res) => res.send("Fanaka Admin Backend Running"));

// MongoDB connection
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI not defined");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected!");
    server.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

// DB events
mongoose.connection.on("error", (err) =>
  console.error("MongoDB error:", err)
);
mongoose.connection.on("disconnected", () =>
  console.warn("MongoDB disconnected")
);
mongoose.connection.on("reconnected", () =>
  console.log("MongoDB reconnected")
);

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});

connectDB();
