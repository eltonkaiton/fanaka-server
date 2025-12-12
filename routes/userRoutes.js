import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const router = express.Router();

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // exclude password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REGISTER (self create)
router.post("/register", async (req, res) => {
  try {
    const { username, fullName, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const newUser = new User({
      username,
      fullName,
      email,
      phone,
      password,
      role: "Audience",
    });

    await newUser.save();

    const userWithoutPassword = newUser.toObject();
    delete userWithoutPassword.password;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN CREATE user
router.post("/", async (req, res) => {
  try {
    const { username, fullName, email, phone, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const newUser = new User({ username, fullName, email, phone, password, role });
    await newUser.save();

    const userWithoutPassword = newUser.toObject();
    delete userWithoutPassword.password;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user
router.put("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { username, fullName, email, phone, password, role, status } = req.body;

    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;

    if (password && password.trim() !== "") {
      user.password = password;
    }

    if (status && ["Pending", "Active", "Rejected", "Suspended"].includes(status)) {
      user.status = status;
    }

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.password;
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE user
router.delete("/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ LOGIN ENDPOINT (NEW)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    // 3. Check if account is active
    if (user.status !== "Active") {
      return res.status(403).json({
        message: `Account is ${user.status}. Only active users can login.`,
      });
    }

    // 4. Return user without password
    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "Login successful",
      user: userData,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
