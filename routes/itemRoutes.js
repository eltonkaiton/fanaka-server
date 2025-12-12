import express from "express";
import { getAllItems, getLowStockItems, getItemById } from "../controllers/itemController.js";

const router = express.Router();

// Routes
router.get("/", getAllItems);          // GET /api/items
router.get("/low-stock", getLowStockItems); // GET /api/items/low-stock
router.get("/:id", getItemById);       // GET /api/items/:id

export default router;
