// routes/employeeRoutes.js
import express from "express";
import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// =======================
// 1️⃣ LOGIN (Play Manager)
// POST: /api/employees/login
// =======================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const employee = await Employee.findOne({ email });
    if (!employee) return res.status(400).json({ message: "Employee not found" });

    // Check password
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect email or password" });

    // Optional: Only allow Production dept to login to Play Manager dashboard
    // (remove this if all employees can log in)
    // if (employee.department !== "Production") {
    //   return res.status(403).json({ message: "Access denied: Not a Play Manager" });
    // }

    // Generate JWT token
    const token = jwt.sign(
      { id: employee._id, department: employee.department, email: employee.email },
      process.env.JWT_SECRET || "super_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        salary: employee.salary,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// 2️⃣ GET all employees
// GET: /api/employees
// =======================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().select("-password");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 3️⃣ GET employee by ID
// GET: /api/employees/:id
// =======================
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select("-password");
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// 4️⃣ CREATE new employee
// POST: /api/employees
// =======================
router.post("/", async (req, res) => {
  try {
    const { fullName, email, phone, department, position, salary, password } = req.body;

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: "Employee with this email already exists" });

    const newEmployee = new Employee({ fullName, email, phone, department, position, salary, password });
    await newEmployee.save();

    const employeeWithoutPassword = newEmployee.toObject();
    delete employeeWithoutPassword.password;

    res.status(201).json(employeeWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 5️⃣ UPDATE employee
// PUT: /api/employees/:id
// =======================
router.put("/:id", async (req, res) => {
  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedEmployee) return res.status(404).json({ message: "Employee not found" });
    res.json(updatedEmployee);
  } catch (err) {
    res.status(500).json({ message: "Error updating employee" });
  }
});

// =======================
// 6️⃣ DELETE employee
// DELETE: /api/employees/:id
// =======================
router.delete("/:id", async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
