import Employee from "../models/Employee.js"; // Using Employee model
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Admin login
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find employee by email
    const admin = await Employee.findOne({ email });

    if (!admin) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check department
    if (admin.department !== "Administration") {
      return res.status(403).json({ message: "Access denied. Not an admin." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, email: admin.email, department: admin.department },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      admin: {
        fullName: admin.fullName,
        email: admin.email,
        department: admin.department,
        position: admin.position,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
