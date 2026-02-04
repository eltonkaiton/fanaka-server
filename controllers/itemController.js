import Item from "../models/itemModel.js";

// Get all items
export const getAllItems = async (req, res) => {
  try {
    const items = await Item.find({});
    res.status(200).json(items);
  } catch (error) {
    console.error("Fetch Items Error:", error);
    res.status(500).json({ message: "Failed to fetch items", error });
  }
};

// Get low stock items
export const getLowStockItems = async (req, res) => {
  try {
    const items = await Item.find({
      $expr: { $lte: ["$quantity", "$lowStockThreshold"] },
    });
    res.status(200).json(items);
  } catch (error) {
    console.error("Fetch Low Stock Items Error:", error);
    res.status(500).json({ message: "Failed to fetch low stock items", error });
  }
};

// Get single item by ID
export const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.status(200).json(item);
  } catch (error) {
    console.error("Fetch Item Error:", error);
    res.status(500).json({ message: "Failed to fetch item", error });
  }
};


// Create new item
export const createItem = async (req, res) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    console.error("Create Item Error:", error);
    res.status(400).json({ message: "Failed to create item", error });
  }
};

// Update item (quantity deduction happens here)
export const updateItem = async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json(item);
  } catch (error) {
    console.error("Update Item Error:", error);
    res.status(400).json({ message: "Failed to update item", error });
  }
};

