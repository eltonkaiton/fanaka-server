// controllers/employeeController.js
import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(400).json({ message: "Employee not found" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    // Create JWT
    const token = jwt.sign(
      {
        id: employee._id,
        department: employee.department,
        email: employee.email,
      },
      process.env.JWT_SECRET || "super_secret_key",
      { expiresIn: "7d" }
    );

    // Success response
    res.json({
      message: "Login successful",
      employee,
      token,
    });

  } catch (error) {
    console.error("Employee Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
