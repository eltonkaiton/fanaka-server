// routes/orderRoutes.js - FULLY UPDATED WITH SUPPLIER PAYMENT CONFIRMATION
import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Item from "../models/itemModel.js";
import { body, validationResult } from "express-validator";
const router = express.Router();

// [All existing GET endpoints exactly as before]
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("item", "name category unit currentStock")
      .populate("supplier", "fullName email phone department")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error("GET ALL ORDERS ERROR:", err);
    res.status(500).json({ success: false, message: "Server error fetching orders", error: err.message });
  }
});

router.get("/supplier/:supplierId", async (req, res) => {
  try {
    const { supplierId } = req.params;
    let query = mongoose.Types.ObjectId.isValid(supplierId) ? { supplier: supplierId } : { supplierName: supplierId };
    const orders = await Order.find(query)
      .populate("item", "name")
      .populate("supplier", "fullName email department")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error("GET SUPPLIER ORDERS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch supplier orders", error: err.message });
  }
});

// GET orders pending payment confirmation from supplier
router.get("/supplier/:supplierId/pending-confirmation", async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const orders = await Order.find({
      $or: [
        { supplier: supplierId },
        { supplierName: { $regex: supplierId, $options: 'i' } }
      ],
      'payment.status': 'Paid',
      'payment.supplierConfirmation': false
    })
    .populate("item", "name description")
    .populate("supplier", "fullName email phone")
    .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("GET PENDING CONFIRMATION ORDERS ERROR:", error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("item", "name description category unit currentStock")
      .populate("supplier", "fullName email phone department position");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    console.error("GET ORDER BY ID ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Invalid order ID format" });
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

router.post("/", [
  body("quantity", "Quantity must be at least 1").isFloat({ min: 1 }),
  body("unitPrice", "Unit price must be greater than 0").isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { item, itemName, supplier, supplierName, quantity, unitPrice, description, estimatedDelivery } = req.body;
    if (!item && !itemName) return res.status(400).json({ success: false, message: "Please provide either item ID or item name" });
    if (!supplier && !supplierName) return res.status(400).json({ success: false, message: "Please provide either supplier ID or supplier name" });
    if (item) {
      const itemExists = await Item.findById(item);
      if (!itemExists) return res.status(404).json({ success: false, message: "Item not found" });
    }
    const totalCost = quantity * unitPrice;
    const newOrder = await Order.create({ 
      item, itemName, supplier, supplierName, quantity, unitPrice,
      totalCost, description, estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      status: "Pending", 
      payment: { 
        status: "Pending",
        supplierConfirmation: false
      }
    });
    const populatedOrder = await Order.findById(newOrder._id)
      .populate("item", "name")
      .populate("supplier", "fullName");
    res.status(201).json({ success: true, message: "Order created successfully", order: populatedOrder });
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    if (err.name === "ValidationError") return res.status(400).json({ success: false, message: "Validation failed", error: err.message });
    res.status(500).json({ success: false, message: "Failed to create order", error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (updateData.quantity || updateData.unitPrice) {
      const existingOrder = await Order.findById(id);
      if (existingOrder) {
        const quantity = updateData.quantity || existingOrder.quantity;
        const unitPrice = updateData.unitPrice || existingOrder.unitPrice;
        updateData.totalCost = quantity * unitPrice;
      }
    }
    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate("item", "name")
      .populate("supplier", "fullName");
    if (!updatedOrder) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, message: "Order updated successfully", order: updatedOrder });
  } catch (err) {
    console.error("UPDATE ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    if (err.name === "ValidationError") return res.status(400).json({ success: false, message: "Validation failed", error: err.message });
    res.status(500).json({ success: false, message: "Failed to update order", error: err.message });
  }
});

// SUPPLIER PAYMENT CONFIRMATION ENDPOINT
router.put("/:id/confirm-payment", async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      confirmedBy, 
      confirmedByName, 
      transactionProof, 
      confirmationNotes 
    } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if payment is already confirmed
    if (order.payment.supplierConfirmation) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already confirmed by supplier' 
      });
    }

    // Check if payment status is "Paid"
    if (order.payment.status !== 'Paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot confirm payment. Payment status is not "Paid"' 
      });
    }

    // Update payment confirmation
    order.payment.supplierConfirmation = true;
    order.payment.confirmedBy = {
      id: confirmedBy || 'supplier_id',
      name: confirmedByName || 'Supplier'
    };
    order.payment.confirmedByName = confirmedByName || 'Supplier';
    order.payment.confirmationDate = new Date();
    order.payment.transactionProof = transactionProof || '';
    order.payment.confirmationNotes = confirmationNotes || `Payment confirmed as received by supplier. Proof: ${transactionProof}`;
    
    // Optionally update payment status to "Confirmed"
    // order.payment.status = "Confirmed";

    await order.save();

    res.json({ 
      success: true, 
      message: 'Payment confirmed successfully', 
      order 
    });

  } catch (error) {
    console.error("CONFIRM PAYMENT ERROR:", error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.put("/:id/approve", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "Approved") return res.status(400).json({ success: false, message: "Order is already approved" });
    order.status = "Approved";
    await order.save();
    const populatedOrder = await Order.findById(order._id)
      .populate("item", "name")
      .populate("supplier", "fullName");
    res.json({ success: true, message: "Order approved successfully", order: populatedOrder });
  } catch (err) {
    console.error("APPROVE ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to approve order", error: err.message });
  }
});

router.put("/:id/deliver", async (req, res) => {
  try {
    const { trackingNumber, deliveryDate } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "Delivered") return res.status(400).json({ success: false, message: "Order is already marked as delivered" });
    order.status = "Delivered";
    order.deliveryDate = deliveryDate ? new Date(deliveryDate) : new Date();
    if (trackingNumber) order.trackingNumber = trackingNumber;
    await order.save();
    res.json({ success: true, message: "Order marked as delivered", order });
  } catch (err) {
    console.error("DELIVER ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to mark order as delivered", error: err.message });
  }
});

// MARK AS RECEIVED - UPDATED TO SET PAYMENT PENDING
router.put("/:id/receive", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status !== "Delivered") return res.status(400).json({ success: false, message: "Only delivered orders can be marked as received" });
    if (order.status === "Received") return res.status(400).json({ success: false, message: "Order is already marked as received" });

    // Update inventory stock
    if (order.item) {
      const item = await Item.findById(order.item);
      if (item) {
        const validCategories = ["Electronics", "Furniture", "Stationery", "Cleaning", "Food", "Beverages", "Office", "Medical", "Equipment", "Other"];
        if (!validCategories.includes(item.category)) {
          if (item.category === "equipment") item.category = "Equipment";
          else if (item.category === "Tools" || item.category === "tools") item.category = "Equipment";
          else item.category = "Other";
        }
        item.currentStock += order.quantity;
        item.lastRestocked = new Date();
        try {
          await item.save();
        } catch (saveError) {
          if (saveError.name === 'ValidationError') {
            await Item.updateOne(
              { _id: item._id },
              { $inc: { currentStock: order.quantity }, $set: { lastRestocked: new Date() } }
            );
          } else throw saveError;
        }
      }
    }

    // MARK ORDER AS RECEIVED AND SET PAYMENT PENDING
    order.status = "Payment Pending";
    order.payment.status = "Pending";
    await order.save();
    
    res.json({
      success: true,
      message: "Order marked as received. Inventory updated. Order is now ready for payment submission.",
      order
    });
  } catch (err) {
    console.error("RECEIVE ORDER ERROR:", err);
    if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: "Item validation failed.", error: err.message });
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to mark order as received", error: err.message });
  }
});

// SUBMIT PAYMENT REQUEST (Inventory/Procurement submits for finance approval)
router.put("/:id/submit-payment", async (req, res) => {
  try {
    const { userId, userName, userRole, paymentMethod, transactionId, notes } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({ success: false, message: "User information is required" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status !== "Payment Pending") {
      return res.status(400).json({
        success: false,
        message: "Only orders with 'Payment Pending' status can have payment submitted"
      });
    }

    // Update order payment with proper object structure
    order.status = "Received";
    order.payment.status = "Submitted";
    order.payment.submittedBy = {
      id: userId,
      name: userName,
      role: userRole || "Inventory"
    };
    order.payment.submittedAt = new Date();
    order.payment.paymentMethod = paymentMethod || "Bank Transfer";
    order.payment.transactionId = transactionId || "";
    order.payment.notes = notes || "";
    order.payment.amountPaid = order.totalCost;

    await order.save();

    res.json({
      success: true,
      message: "Payment request submitted successfully. Awaiting finance approval.",
      order
    });
  } catch (err) {
    console.error("SUBMIT PAYMENT ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to submit payment request", error: err.message });
  }
});

// APPROVE PAYMENT (Finance department approves payment request) - SIMPLIFIED VERSION
router.put("/:id/approve-payment", async (req, res) => {
  try {
    const { userId, userName } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ 
        success: false, 
        message: "Approver information (userId and userName) is required" 
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.payment.status !== "Submitted") {
      return res.status(400).json({ 
        success: false, 
        message: "Only submitted payments can be approved. Current status: " + order.payment.status 
      });
    }

    // SIMPLIFIED: Just update the status and add approvedBy as object
    order.payment.status = "Approved";
    order.payment.approvedBy = {
      id: userId,
      name: userName,
      role: "Finance"
    };
    order.payment.approvedAt = new Date();

    await order.save();
    
    res.json({
      success: true,
      message: "Payment approved successfully. Ready for processing.",
      order
    });
  } catch (err) {
    console.error("APPROVE PAYMENT ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    if (err.name === "ValidationError") {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        error: err.message
      });
    }
    res.status(500).json({ success: false, message: "Failed to approve payment", error: err.message });
  }
});

// PROCESS PAYMENT (Finance department processes payment and marks as paid) - SIMPLIFIED
router.put("/:id/process-payment", async (req, res) => {
  try {
    const { userId, userName, paymentMethod, transactionId, amountPaid, notes } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ 
        success: false, 
        message: "User information (userId and userName) is required" 
      });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment method is required" 
      });
    }
    
    if (paymentMethod !== "Cash" && !transactionId) {
      return res.status(400).json({ 
        success: false, 
        message: "Transaction ID is required for non-cash payments" 
      });
    }
    
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid amount paid is required" 
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.payment.status !== "Submitted" && order.payment.status !== "Approved") {
      return res.status(400).json({ 
        success: false, 
        message: "Only submitted or approved payments can be processed. Current status: " + order.payment.status 
      });
    }

    // Update order with payment details
    order.status = "Paid";
    order.payment.status = "Paid";
    order.payment.paymentMethod = paymentMethod;
    order.payment.transactionId = transactionId || "";
    order.payment.amountPaid = parseFloat(amountPaid);
    order.payment.paymentDate = new Date();
    
    // Set processedBy as object
    order.payment.processedBy = {
      id: userId,
      name: userName,
      role: "Finance"
    };
    
    order.payment.processedAt = new Date();
    
    // Add notes
    if (notes) {
      order.payment.notes = (order.payment.notes || "") + "\nPayment processed: " + notes;
    }

    await order.save();
    
    res.json({
      success: true,
      message: "Payment processed successfully and order marked as paid",
      order
    });
  } catch (err) {
    console.error("PROCESS PAYMENT ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to process payment", error: err.message });
  }
});

// REJECT PAYMENT (Finance department rejects payment) - SINGLE CORRECTED ENDPOINT
router.put("/:id/reject-payment", async (req, res) => {
  try {
    const { userId, userName, reason } = req.body;
    if (!userId || !userName) return res.status(400).json({ success: false, message: "Approver information is required" });
    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason is required" });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.payment.status !== "Submitted") {
      return res.status(400).json({ 
        success: false, 
        message: "Only submitted payments can be rejected" 
      });
    }

    order.status = "Received";
    order.payment.status = "Rejected";
    
    // Add rejection info to notes since schema doesn't have rejectedBy field
    order.payment.notes = (order.payment.notes || "") + `\nREJECTED by ${userName} (ID: ${userId}) on ${new Date().toLocaleDateString()}: ${reason}`;

    await order.save();
    
    res.json({
      success: true,
      message: "Payment rejected. Order returned to inventory for review.",
      order
    });
  } catch (err) {
    console.error("REJECT PAYMENT ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to reject payment", error: err.message });
  }
});

// MARK AS PAID (Direct marking without approval flow)
router.put("/:id/mark-paid", async (req, res) => {
  try {
    const { paymentMethod, transactionId, paymentDate, notes } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    order.status = "Paid";
    order.payment = {
      status: "Paid",
      paymentMethod: paymentMethod || "Bank Transfer",
      transactionId: transactionId || "",
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes || "",
      amountPaid: order.totalCost,
      submittedAt: new Date(),
      submittedBy: {
        id: "system",
        name: "System",
        role: "System"
      },
      supplierConfirmation: false
    };

    await order.save();
    
    res.json({
      success: true,
      message: "Order marked as paid successfully",
      order
    });
  } catch (err) {
    console.error("MARK PAID ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to mark order as paid", error: err.message });
  }
});

// GET ORDERS BY PAYMENT STATUS
router.get("/payment-status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ["Pending", "Submitted", "Approved", "Paid", "Rejected"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid payment status. Valid statuses are: " + validStatuses.join(", ") 
      });
    }
    
    const orders = await Order.find({ "payment.status": status })
      .populate("item", "name")
      .populate("supplier", "fullName email")
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error("GET ORDERS BY PAYMENT STATUS ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch orders by payment status",
      error: err.message 
    });
  }
});

// GET ORDERS BY STATUS AND PAYMENT STATUS COMBINED
router.get("/status/:status/payment/:paymentStatus", async (req, res) => {
  try {
    const { status, paymentStatus } = req.params;
    
    const validStatuses = ["Pending", "Approved", "Processing", "Delivered", "Rejected", "Received", "Payment Pending", "Paid", "Cancelled"];
    const validPaymentStatuses = ["Pending", "Submitted", "Approved", "Paid", "Rejected"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid status. Valid statuses are: " + validStatuses.join(", ") 
      });
    }
    
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid payment status. Valid statuses are: " + validPaymentStatuses.join(", ") 
      });
    }
    
    const orders = await Order.find({ 
      status: status,
      "payment.status": paymentStatus
    })
      .populate("item", "name")
      .populate("supplier", "fullName")
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error("GET ORDERS BY STATUS AND PAYMENT ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch orders",
      error: err.message 
    });
  }
});

// GET FINANCE SUMMARY (for dashboard)
router.get("/finance/summary", async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingPayments = await Order.countDocuments({ "payment.status": "Submitted" });
    const approvedPayments = await Order.countDocuments({ "payment.status": "Approved" });
    const paidOrders = await Order.countDocuments({ "payment.status": "Paid" });
    const pendingConfirmation = await Order.countDocuments({ 
      "payment.status": "Paid", 
      "payment.supplierConfirmation": false 
    });
    
    // Calculate total amounts
    const submittedAmount = await Order.aggregate([
      { $match: { "payment.status": "Submitted" } },
      { $group: { _id: null, total: { $sum: "$totalCost" } } }
    ]);
    
    const approvedAmount = await Order.aggregate([
      { $match: { "payment.status": "Approved" } },
      { $group: { _id: null, total: { $sum: "$totalCost" } } }
    ]);
    
    const paidAmount = await Order.aggregate([
      { $match: { "payment.status": "Paid" } },
      { $group: { _id: null, total: { $sum: "$totalCost" } } }
    ]);
    
    const pendingConfirmationAmount = await Order.aggregate([
      { $match: { "payment.status": "Paid", "payment.supplierConfirmation": false } },
      { $group: { _id: null, total: { $sum: "$totalCost" } } }
    ]);
    
    res.json({
      success: true,
      summary: {
        totalOrders,
        pendingPayments,
        approvedPayments,
        paidOrders,
        pendingConfirmation,
        submittedAmount: submittedAmount[0]?.total || 0,
        approvedAmount: approvedAmount[0]?.total || 0,
        paidAmount: paidAmount[0]?.total || 0,
        pendingConfirmationAmount: pendingConfirmationAmount[0]?.total || 0
      }
    });
  } catch (err) {
    console.error("GET FINANCE SUMMARY ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch finance summary",
      error: err.message 
    });
  }
});

// GET RECENT PAYMENT ACTIVITY
router.get("/finance/recent-payments", async (req, res) => {
  try {
    const recentPayments = await Order.find({
      "payment.status": { $in: ["Submitted", "Approved", "Paid", "Rejected"] }
    })
      .populate("item", "name")
      .populate("supplier", "fullName")
      .sort({ "payment.submittedAt": -1 })
      .limit(20);
    
    res.json({
      success: true,
      count: recentPayments.length,
      payments: recentPayments
    });
  } catch (err) {
    console.error("GET RECENT PAYMENTS ERROR:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch recent payments",
      error: err.message 
    });
  }
});

// GET PAYMENT DETAILS FOR SPECIFIC ORDER
router.get("/:id/payment-details", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select("payment totalCost status itemName supplierName")
      .populate("item", "name")
      .populate("supplier", "fullName");
    
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    
    res.json({
      success: true,
      order: {
        _id: order._id,
        itemName: order.item?.name || order.itemName,
        supplierName: order.supplier?.fullName || order.supplierName,
        totalCost: order.totalCost,
        status: order.status,
        payment: order.payment
      }
    });
  } catch (err) {
    console.error("GET PAYMENT DETAILS ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Invalid order ID format" });
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch payment details",
      error: err.message 
    });
  }
});

// REJECT order (keep existing)
router.put("/:id/reject", async (req, res) => {
  try {
    const { notes } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "Rejected") return res.status(400).json({ success: false, message: "Order is already rejected" });
    order.status = "Rejected";
    if (notes) order.notes = notes;
    await order.save();
    res.json({ success: true, message: "Order rejected", order });
  } catch (err) {
    console.error("REJECT ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to reject order", error: err.message });
  }
});

// DELETE order (keep existing)
router.delete("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.status === "Approved" || order.status === "Delivered" || order.status === "Received" || order.status === "Paid") {
      return res.status(400).json({ success: false, message: "Cannot delete approved, delivered, received, or paid orders" });
    }
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Order deleted successfully" });
  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to delete order", error: err.message });
  }
});

// GET orders by status (keep existing)
router.get("/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ["Pending", "Approved", "Processing", "Delivered", "Rejected", "Received", "Payment Pending", "Paid", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid status. Valid statuses are: " + validStatuses.join(", ") 
      });
    }
    const orders = await Order.find({ status })
      .populate("item", "name")
      .populate("supplier", "fullName")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error("GET ORDERS BY STATUS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders by status", error: err.message });
  }
});

// UPDATE PAYMENT DETAILS (Edit payment information)
router.put("/:id/update-payment", async (req, res) => {
  try {
    const { paymentMethod, transactionId, amountPaid, notes } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.payment.status === "Paid") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot update payment details for already paid orders" 
      });
    }

    if (paymentMethod) order.payment.paymentMethod = paymentMethod;
    if (transactionId !== undefined) order.payment.transactionId = transactionId;
    if (amountPaid) order.payment.amountPaid = parseFloat(amountPaid);
    if (notes) order.payment.notes = notes;

    await order.save();
    
    res.json({
      success: true,
      message: "Payment details updated successfully",
      order
    });
  } catch (err) {
    console.error("UPDATE PAYMENT ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to update payment details", error: err.message });
  }
});

// CANCEL ORDER (with payment cleanup if needed)
router.put("/:id/cancel", async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status === "Paid") {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot cancel already paid orders" 
      });
    }

    // If order was delivered/received, revert inventory
    if ((order.status === "Delivered" || order.status === "Received" || order.status === "Payment Pending") && order.item) {
      const item = await Item.findById(order.item);
      if (item) {
        item.currentStock -= order.quantity;
        await item.save();
      }
    }

    order.status = "Cancelled";
    if (reason) order.cancellationReason = reason;
    order.cancelledAt = new Date();
    
    // Reset payment if it exists
    if (order.payment) {
      order.payment.status = "Cancelled";
      order.payment.notes = (order.payment.notes || "") + "\nOrder cancelled: " + (reason || "No reason provided");
    }

    await order.save();
    
    res.json({
      success: true,
      message: "Order cancelled successfully",
      order
    });
  } catch (err) {
    console.error("CANCEL ORDER ERROR:", err);
    if (err.kind === "ObjectId") return res.status(404).json({ success: false, message: "Order not found" });
    res.status(500).json({ success: false, message: "Failed to cancel order", error: err.message });
  }
});

// GET orders with pending supplier confirmation
router.get("/payment/pending-confirmation", async (req, res) => {
  try {
    const orders = await Order.find({
      "payment.status": "Paid",
      "payment.supplierConfirmation": false
    })
    .populate("item", "name description")
    .populate("supplier", "fullName email phone")
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error("GET PENDING CONFIRMATION ORDERS ERROR:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch orders pending confirmation',
      error: error.message 
    });
  }
});

export default router;