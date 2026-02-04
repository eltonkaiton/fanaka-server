import express from "express";
import {
  getAllItems,
  getLowStockItems,
  getItemById,
  createItem,
  updateItem
} from "../controllers/itemController.js";

const router = express.Router();

router.get("/", getAllItems);
router.get("/low-stock", getLowStockItems);
router.get("/:id", getItemById);

// ✅ ADD THESE
router.post("/", createItem);        // POST /api/items
router.put("/:id", updateItem);      // PUT /api/items/:id

export default router;
