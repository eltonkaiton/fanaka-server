import Order from "../models/orderModel.js";

/**
 * CREATE ORDER
 * POST /api/orders
 */
export const createOrder = async (req, res) => {
  try {
    const { item, quantity, unitPrice } = req.body;

    if (!item || !quantity || !unitPrice) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const order = await Order.create({
      item,
      quantity,
      unitPrice
    });

    res.status(201).json(order);
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: "Failed to create order", error });
  }
};

/**
 * GET ALL ORDERS
 * GET /api/orders
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Failed to fetch orders", error });
  }
};

/**
 * UPDATE ORDER STATUS (Mark as Paid)
 * PATCH /api/orders/:id
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Update Order Error:", error);
    res.status(500).json({ message: "Failed to update order", error });
  }
};

/**
 * DELETE ORDER (Optional)
 * DELETE /api/orders/:id
 */
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Delete Order Error:", error);
    res.status(500).json({ message: "Failed to delete order", error });
  }
};
