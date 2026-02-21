import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Your admin token uses { id: admin._id }
    const adminId = decoded.id;

    if (!adminId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const admin = await Employee.findById(adminId).select("-password");

    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    // ✅ Extra safety: ensure department is Administration
    if (admin.department !== "Administration") {
      return res.status(403).json({ message: "Access denied. Not an admin." });
    }

    req.user = admin;
    req.userId = adminId;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};

export default auth;