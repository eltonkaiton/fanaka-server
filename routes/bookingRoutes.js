import express from "express";
import Booking from "../models/Booking.js";
import Play from "../models/Play.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// Middleware to check if user is authenticated (you should implement this properly)
const requireAuth = (req, res, next) => {
  // This is a placeholder - implement your actual authentication logic
  // For example: if (!req.user) return res.status(401).json({ success: false, msg: "Unauthorized" });
  next();
};

// CREATE BOOKING
router.post("/", requireAuth, [
  body("playId", "Play ID is required").not().isEmpty(),
  body("ticketType", "Ticket type is required").isIn(["regular", "vip", "vvip"]),
  body("quantity", "Quantity must be at least 1").isInt({ min: 1 }),
  body("totalPrice", "Total price is required").isFloat({ min: 0 }),
  body("paymentMethod", "Payment method is required").not().isEmpty(),
  body("paymentCode", "Payment code is required").not().isEmpty(),
  body("allocatedSeats", "Allocated seats are required").not().isEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { 
      playId, 
      playTitle, 
      ticketType, 
      quantity, 
      allocatedSeats, 
      totalPrice, 
      paymentMethod, 
      paymentCode, 
      playDate, 
      customerName, 
      customerEmail, 
      customerPhone 
    } = req.body;

    // Validate required fields from authenticated user
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, msg: "User authentication required" });
    }

    // Find the play
    const play = await Play.findById(playId);
    if (!play) {
      return res.status(404).json({ success: false, msg: "Play not found" });
    }

    // Validate play date
    const eventDate = new Date(playDate);
    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({ success: false, msg: "Invalid play date" });
    }

    // Parse allocated seats if it's a string
    let parsedSeats = allocatedSeats;
    if (typeof allocatedSeats === "string") {
      try {
        parsedSeats = JSON.parse(allocatedSeats);
      } catch {
        return res.status(400).json({ 
          success: false, 
          msg: "Invalid allocatedSeats format. Must be a JSON array of seat objects." 
        });
      }
    }

    // Validate seats allocation
    if (!Array.isArray(parsedSeats) || parsedSeats.length === 0) {
      return res.status(400).json({ success: false, msg: "Valid seat allocation is required" });
    }

    if (parsedSeats.length !== quantity) {
      return res.status(400).json({ 
        success: false, 
        msg: `Seat allocation mismatch. Allocated: ${parsedSeats.length}, Quantity: ${quantity}` 
      });
    }

    // Generate unique booking reference
    const bookingReference = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create booking
    const booking = new Booking({
      playId,
      playTitle: playTitle || play.title,
      bookingReference,
      userId: req.user.id,
      customerName: customerName || req.user.fullName || req.user.name,
      customerEmail: customerEmail || req.user.email,
      customerPhone: customerPhone || req.user.phone || "",
      ticketType,
      quantity,
      allocatedSeats: parsedSeats,
      totalPrice,
      paymentMethod: paymentMethod || "manual",
      paymentCode,
      playDate: eventDate,
      status: "confirmed",
      paymentStatus: "pending"
    });

    const savedBooking = await booking.save();

    res.status(201).json({
      success: true,
      message: "Booking confirmed successfully!",
      booking: {
        id: savedBooking._id,
        bookingReference: savedBooking.bookingReference,
        playTitle: savedBooking.playTitle,
        ticketType: savedBooking.ticketType,
        quantity: savedBooking.quantity,
        allocatedSeats: savedBooking.allocatedSeats,
        totalPrice: savedBooking.totalPrice,
        paymentMethod: savedBooking.paymentMethod,
        paymentCode: savedBooking.paymentCode,
        paymentStatus: savedBooking.paymentStatus,
        bookingDate: savedBooking.bookingDate,
        playDate: savedBooking.playDate,
        status: savedBooking.status
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, msg: "Duplicate booking reference" });
    }
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, msg: "Invalid play ID format" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, msg: "Validation failed", error: err.message });
    }
    console.error("CREATE BOOKING ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error while processing booking", error: err.message });
  }
});

// GET ALL BOOKINGS (Admin only)
router.get("/", requireAuth, async (req, res) => {
  try {
    // Add admin check here: if (!req.user.isAdmin) return res.status(403).json(...)
    
    const bookings = await Booking.find()
      .sort({ bookingDate: -1 })
      .populate("playId", "title image venue date")
      .populate("approvedBy", "name email"); // Populate approvedBy user details

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingReference: booking.bookingReference,
        play: booking.playId,
        playTitle: booking.playTitle,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        paymentStatus: booking.paymentStatus,
        approvedBy: booking.approvedBy,
        approvedAt: booking.approvedAt,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats,
        totalPrice: booking.totalPrice,
        bookingDate: booking.bookingDate,
        playDate: booking.playDate,
        status: booking.status,
        createdAt: booking.createdAt
      }))
    });
  } catch (err) {
    console.error("GET ALL BOOKINGS ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// GET USER'S BOOKINGS
router.get("/my-bookings", requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ success: false, msg: "User authentication required" });
    }

    const userEmail = req.user.email;
    const bookings = await Booking.find({ customerEmail: userEmail })
      .sort({ bookingDate: -1 })
      .populate("playId", "title image venue date regularPrice vipPrice vvipPrice");

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingReference: booking.bookingReference,
        playId: booking.playId?._id,
        play: booking.playId,
        playTitle: booking.playTitle,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        approvedBy: booking.approvedBy,
        approvedAt: booking.approvedAt,
        bookingDate: booking.bookingDate,
        playDate: booking.playDate,
        status: booking.status,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        createdAt: booking.createdAt
      }))
    });
  } catch (err) {
    console.error("GET USER BOOKINGS ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error while fetching user bookings", error: err.message });
  }
});

// GET BOOKING BY ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("playId", "title image venue date description actors")
      .populate("approvedBy", "name email");

    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Check if user is authorized to view this booking
    if (!req.user.isAdmin && booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, msg: "Unauthorized to view this booking" });
    }

    res.json({
      success: true,
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        playId: booking.playId?._id,
        play: booking.playId,
        playTitle: booking.playTitle,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        approvedBy: booking.approvedBy,
        approvedAt: booking.approvedAt,
        bookingDate: booking.bookingDate,
        playDate: booking.playDate,
        status: booking.status,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }
    });
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, msg: "Invalid booking ID format" });
    }
    console.error("GET BOOKING BY ID ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// UPDATE BOOKING
router.put("/:id", requireAuth, [
  body("ticketType").optional().isIn(["regular", "vip", "vvip"]),
  body("quantity").optional().isInt({ min: 1 }),
  body("status").optional().isIn(["pending", "confirmed", "cancelled"]),
  body("paymentStatus").optional().isIn(["pending", "approved", "rejected"])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Check authorization (only admin or booking owner)
    if (!req.user.isAdmin && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, msg: "Unauthorized to update this booking" });
    }

    const updates = req.body;

    // If admin is approving payment
    if (req.user.isAdmin && updates.paymentStatus === 'approved' && booking.paymentStatus !== 'approved') {
      updates.approvedAt = new Date();
      updates.approvedBy = req.user.id; // Set to admin's user ID
    }

    // If admin is rejecting payment
    if (req.user.isAdmin && updates.paymentStatus === 'rejected') {
      updates.approvedBy = null;
      updates.approvedAt = null;
    }

    // Update allowed fields
    const allowedFields = [
      'ticketType', 'quantity', 'status', 'paymentStatus',
      'approvedBy', 'approvedAt', 'customerName', 'customerEmail',
      'customerPhone', 'allocatedSeats', 'totalPrice', 'paymentMethod',
      'paymentCode', 'playDate'
    ];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && key !== "_id" && key !== "bookingReference") {
        booking[key] = updates[key];
      }
    });

    await booking.save();

    res.json({
      success: true,
      message: "Booking updated successfully",
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        playTitle: booking.playTitle,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        approvedBy: booking.approvedBy,
        approvedAt: booking.approvedAt,
        updatedAt: booking.updatedAt
      }
    });
  } catch (err) {
    console.error("UPDATE BOOKING ERROR:", err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// CANCEL BOOKING
router.put("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Check authorization (only admin or booking owner can cancel)
    if (!req.user.isAdmin && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, msg: "Unauthorized to cancel this booking" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ success: false, msg: "Booking is already cancelled" });
    }

    if (new Date(booking.playDate) < new Date()) {
      return res.status(400).json({ success: false, msg: "Cannot cancel past events" });
    }

    booking.status = "cancelled";
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        playTitle: booking.playTitle,
        paymentStatus: booking.paymentStatus
      }
    });
  } catch (err) {
    console.error("CANCEL BOOKING ERROR:", err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// DELETE BOOKING (Admin only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, msg: "Admin access required" });
    }

    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    await Booking.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    console.error("DELETE BOOKING ERROR:", err);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ success: false, msg: "Invalid booking ID" });
    }
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

export default router;