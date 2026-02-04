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
import bookingRoutes from "./routes/bookingRoutes.js";

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
app.use("/api/bookings", bookingRoutes);

// Test Route
app.get("/", (req, res) => res.send("Fanaka Admin Backend Running"));

// Connect to MongoDB with improved error handling
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    console.log("Attempting to connect to MongoDB...");
    console.log(`MongoDB URI: ${process.env.MONGO_URI.replace(/:[^:]*@/, ':****@')}`); // Hide password in logs
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log("✅ MongoDB connected successfully!");
    
    // Start server only after DB connection is established
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error("\n❌ MongoDB connection FAILED!");
    console.error("=========================================");
    console.error("Error Details:");
    console.error(`Error Name: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Error Code: ${error.code || 'N/A'}`);
    
    // Provide specific troubleshooting tips based on error
    if (error.name === 'MongoParseError') {
      console.error("\n⚠️  Possible causes:");
      console.error("- Invalid MongoDB connection string format");
      console.error("- Missing database name in URI");
      console.error("- Special characters in password not URL encoded");
    } else if (error.name === 'MongoNetworkError') {
      console.error("\n⚠️  Possible causes:");
      console.error("- MongoDB server is not running");
      console.error("- Network connectivity issues");
      console.error("- Firewall blocking connection");
      console.error("- Incorrect host/port in MONGO_URI");
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error("\n⚠️  Possible causes:");
      console.error("- Authentication failed (wrong username/password)");
      console.error("- Database name doesn't exist");
      console.error("- IP not whitelisted in MongoDB Atlas");
    }
    
    console.error("\n🔧 Troubleshooting steps:");
    console.error("1. Check if MongoDB is running locally: mongod --version");
    console.error("2. Verify MONGO_URI in .env file");
    console.error("3. Check network connectivity to MongoDB host");
    console.error("4. Verify database credentials");
    console.error("5. For Atlas: Check IP whitelist and cluster status");
    
    process.exit(1); // Exit process with failure
  }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully!');
});

// Handle application termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during MongoDB disconnection:', err);
    process.exit(1);
  }
});

// Start the database connection
connectDB();