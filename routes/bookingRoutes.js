import express from "express";
import Booking from "../models/Booking.js";
import Play from "../models/Play.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  // Implement your actual authentication logic here
  // For now, we'll assume token verification happens in server.js
  next();
};

// ✅ GET ALL BOOKINGS (with filters)
router.get("/", requireAuth, async (req, res) => {
  try {
    const { date, status } = req.query;
    let filter = {};

    // Filter by date
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      filter.playDate = { $gte: startDate, $lt: endDate };
    }

    // Filter by status
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .sort({ bookingDate: -1 })
      .populate("playId", "title image venue date");

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingReference: booking.bookingReference,
        playId: booking.playId?._id,
        playTitle: booking.playTitle || booking.playId?.title,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats || [],
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        playDate: booking.playDate,
        status: booking.status,
        checkedIn: booking.checkedIn || false,
        checkInTime: booking.checkInTime,
        bookingDate: booking.bookingDate,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      }))
    });
  } catch (err) {
    console.error("GET ALL BOOKINGS ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// ✅ VERIFY BOOKING BY REFERENCE (For Ushers)
router.get("/verify/:reference", requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      return res.status(400).json({ success: false, msg: "Booking reference is required" });
    }

    const booking = await Booking.findOne({ bookingReference: reference })
      .populate("playId", "title image venue date");

    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Check if booking is confirmed (payment approved)
    if (booking.status !== "confirmed" && booking.paymentStatus !== "approved") {
      return res.status(400).json({ 
        success: false, 
        msg: "Booking not confirmed or payment pending" 
      });
    }

    res.json({
      success: true,
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        playId: booking.playId?._id,
        playTitle: booking.playTitle || booking.playId?.title,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats || [],
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        playDate: booking.playDate,
        status: booking.status,
        checkedIn: booking.checkedIn || false,
        checkInTime: booking.checkInTime,
        bookingDate: booking.bookingDate
      }
    });
  } catch (err) {
    console.error("VERIFY BOOKING ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// ✅ CHECK-IN CUSTOMER (For Ushers)
router.put("/:id/checkin", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    // Check if already checked in
    if (booking.checkedIn) {
      return res.status(400).json({ 
        success: false, 
        msg: "Customer already checked in",
        checkInTime: booking.checkInTime
      });
    }

    // Check if booking is confirmed
    if (booking.status !== "confirmed" || booking.paymentStatus !== "approved") {
      return res.status(400).json({ 
        success: false, 
        msg: "Cannot check in - booking not confirmed or payment pending" 
      });
    }

    // Update check-in status
    booking.checkedIn = true;
    booking.checkInTime = new Date();
    booking.status = "checked_in"; // Optional: Update status

    await booking.save();

    res.json({
      success: true,
      msg: "Customer checked in successfully",
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        playTitle: booking.playTitle,
        customerName: booking.customerName,
        checkedIn: booking.checkedIn,
        checkInTime: booking.checkInTime,
        status: booking.status
      }
    });
  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ success: false, msg: "Invalid booking ID" });
    }
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// ✅ GET TODAY'S BOOKINGS (For Ushers Dashboard)
router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookings = await Booking.find({
      playDate: { $gte: today, $lt: tomorrow },
      status: "confirmed",
      paymentStatus: "approved"
    })
    .sort({ playDate: 1 })
    .populate("playId", "title date time");

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingReference: booking.bookingReference,
        playTitle: booking.playTitle || booking.playId?.title,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats || [],
        playDate: booking.playDate,
        checkedIn: booking.checkedIn || false,
        checkInTime: booking.checkInTime
      }))
    });
  } catch (err) {
    console.error("GET TODAY'S BOOKINGS ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// ✅ Also update your Booking model to include check-in fields:
// In models/Booking.js add:
/*
checkedIn: {
  type: Boolean,
  default: false
},
checkInTime: {
  type: Date
}
*/

// ✅ CREATE BOOKING (using userId from request body)
router.post(
  "/",
  [
    body("userId", "User ID is required").not().isEmpty(),
    body("playId", "Play ID is required").not().isEmpty(),
    body("ticketType", "Ticket type is required").isIn(["regular", "vip", "vvip"]),
    body("quantity", "Quantity must be at least 1").isInt({ min: 1 }),
    body("totalPrice", "Total price is required").isFloat({ min: 0 }),
    body("paymentMethod", "Payment method is required").not().isEmpty(),
    body("paymentCode", "Payment code is required").not().isEmpty(),
    body("allocatedSeats", "Allocated seats are required").not().isEmpty(),
    body("customerName", "Customer name is required").not().isEmpty(),
    body("customerEmail", "Customer email is required").isEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        userId,
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

      // Validate play exists
      const play = await Play.findById(playId);
      if (!play) {
        return res.status(404).json({ success: false, msg: "Play not found" });
      }

      // Generate unique booking reference
      const bookingReference = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create new booking
      const booking = new Booking({
        playId,
        playTitle: playTitle || play.title,
        bookingReference,
        userId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        ticketType,
        quantity,
        allocatedSeats,
        totalPrice,
        paymentMethod: paymentMethod || "manual",
        paymentCode,
        playDate: new Date(playDate),
        status: "confirmed",
        paymentStatus: "pending",
        checkedIn: false
      });

      const savedBooking = await booking.save();

      return res.status(201).json({
        success: true,
        message: "Booking confirmed successfully!",
        booking: savedBooking
      });

    } catch (err) {
      console.error("CREATE BOOKING ERROR:", err);
      return res.status(500).json({
        success: false,
        msg: "Server error while processing booking",
        error: err.message
      });
    }
  }
);

// GET USER'S BOOKINGS (by userId or email, no token required)
router.get("/my-bookings", async (req, res) => {
  try {
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(400).json({ success: false, msg: "User ID or email is required" });
    }

    const filter = {};
    if (userId) filter.userId = userId;
    if (email) filter.customerEmail = email;

    const bookings = await Booking.find(filter)
      .sort({ bookingDate: -1 })
      .populate("playId", "title image venue date");

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        id: booking._id,
        bookingReference: booking.bookingReference,
        playTitle: booking.playTitle || booking.playId?.title,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        playDate: booking.playDate,
        status: booking.status,
        checkedIn: booking.checkedIn || false,
        checkInTime: booking.checkInTime,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        bookingDate: booking.bookingDate
      }))
    });
  } catch (err) {
    console.error("GET USER BOOKINGS ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});
// GET BOOKING BY ID (keep existing)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("playId", "title image venue date");

    if (!booking) {
      return res.status(404).json({ success: false, msg: "Booking not found" });
    }

    res.json({
      success: true,
      booking: {
        id: booking._id,
        bookingReference: booking.bookingReference,
        playTitle: booking.playTitle,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        allocatedSeats: booking.allocatedSeats,
        totalPrice: booking.totalPrice,
        paymentMethod: booking.paymentMethod,
        paymentCode: booking.paymentCode,
        paymentStatus: booking.paymentStatus,
        playDate: booking.playDate,
        status: booking.status,
        checkedIn: booking.checkedIn || false,
        checkInTime: booking.checkInTime,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        bookingDate: booking.bookingDate,
        createdAt: booking.createdAt
      }
    });
  } catch (err) {
    console.error("GET BOOKING BY ID ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

// UPDATE BOOKING (keep existing)
router.put("/:id", requireAuth, [
  body("ticketType").optional().isIn(["regular", "vip", "vvip"]),
  body("quantity").optional().isInt({ min: 1 }),
  body("status").optional().isIn(["pending", "confirmed", "cancelled", "checked_in"]),
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

    const updates = req.body;
    const allowedFields = ['ticketType', 'quantity', 'status', 'paymentStatus', 'customerName', 'customerEmail', 'customerPhone', 'allocatedSeats', 'totalPrice', 'paymentMethod', 'paymentCode', 'playDate', 'checkedIn', 'checkInTime'];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
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
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        checkedIn: booking.checkedIn,
        checkInTime: booking.checkInTime
      }
    });
  } catch (err) {
    console.error("UPDATE BOOKING ERROR:", err);
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
});

export default router;