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
    console.log("=== LOGIN ATTEMPT DEBUG START ===");
    console.log("Request body received:", req.body);
    console.log("Email received:", req.body.email);
    console.log("Password received (first 3 chars):", req.body.password ? req.body.password.substring(0, 3) + "..." : "undefined");
    console.log("Password length:", req.body.password ? req.body.password.length : "undefined");
    
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log("Login failed: Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find employee with case-insensitive email search
    const employee = await Employee.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    
    console.log("Employee found in DB:", employee ? "YES" : "NO");
    
    if (!employee) {
      console.log(`No employee found with email: ${email}`);
      // Check if any employees exist with similar emails (debugging)
      const similarEmployees = await Employee.find({ 
        email: { $regex: email, $options: 'i' } 
      }).select("email");
      console.log("Similar emails in DB:", similarEmployees.map(e => e.email));
      return res.status(400).json({ message: "Employee not found" });
    }

    console.log("Employee found details:");
    console.log("  - ID:", employee._id);
    console.log("  - Email in DB:", employee.email);
    console.log("  - Department:", employee.department);
    console.log("  - Password hash in DB (first 20 chars):", employee.password.substring(0, 20) + "...");
    console.log("  - Password hash length:", employee.password.length);

    // Check password
    console.log("Comparing password...");
    const isMatch = await bcrypt.compare(password, employee.password);
    console.log("Password match result:", isMatch);
    
    if (!isMatch) {
      console.log("Password mismatch. Debug info:");
      console.log("  - Input password:", password);
      console.log("  - Input password length:", password.length);
      console.log("  - Hash verification failed");
      
      // Additional debug: Hash a test password to see if bcrypt works
      const testHash = await bcrypt.hash("test123", 10);
      console.log("  - Bcrypt test hash generated:", testHash.substring(0, 20) + "...");
      
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    console.log("Password verified successfully");

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

    console.log("Token generated successfully");
    console.log("=== LOGIN ATTEMPT DEBUG END ===");

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
    console.error("Login error details:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
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

// GET employees by department
router.get("/department/:dept", async (req, res) => {
  try {
    const employees = await Employee.find({ department: req.params.dept }).select("-password");
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;