import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIX IS HERE
    const userId = decoded.user?.id;

    if (!userId) {
      return res.status(401).json({ msg: "Invalid token payload" });
    }

    // Find user
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(401).json({ msg: "Token is not valid" });
  }
};

export default auth;
