import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// JWT Secret (store in .env in production)
const JWT_SECRET = "your_jwt_secret_key_change_in_production";

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No authentication token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ---------------------- UNPROTECTED ROUTES ----------------------

// GET all users OR filter by status
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    if (status && ["Active", "Pending", "Suspended", "Rejected"].includes(status)) {
      filter.status = status;
    }
    const users = await User.find(filter).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// REGISTER / ADD NEW USER
router.post("/register", async (req, res) => {
  try {
    const { username, fullName, email, phone, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const newUser = new User({
      username,
      fullName,
      email,
      phone,
      password, // Schema will hash this automatically
      role: role || "Audience"
    });

    await newUser.save(); // Password hashed in schema

    const token = jwt.sign(
      { userId: newUser._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userWithoutPassword = newUser.toObject();
    delete userWithoutPassword.password;

    res.status(201).json({
      message: "User created successfully",
      user: userWithoutPassword,
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (user.status !== "Active") {
      return res.status(403).json({ message: `Account is ${user.status}. Only active users can login.` });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "Login successful",
      user: userData,
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------- UNPROTECTED STATUS UPDATE ----------------------
// Only for changing user status (Pending → Active / Rejected / etc.)
router.put("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Pending", "Active", "Rejected", "Suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.status = status;
    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json({
      message: `User status updated to ${status}`,
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- UNPROTECTED DELETE ----------------------
// Delete a user without token
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------- PROTECTED ROUTES ----------------------

// GET user profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET current user (same as profile)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user (protected, everything except status)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to update this user" });
    }

    const { username, fullName, email, phone, password, role } = req.body;

    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role && req.user.role === "admin") user.role = role;
    if (password && password.trim() !== "") user.password = await bcrypt.hash(password, 10);

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;