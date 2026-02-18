// server/routes/chatRoutes.js
import express from "express";
import ChatMessage from "../models/ChatMessage.js";

export default (io) => {
  const router = express.Router();

  // =====================================================
  // GET messages for a department & customer
  // =====================================================
  router.get("/messages/department/:department/:customerId", async (req, res) => {
    try {
      const { department, customerId } = req.params;

      const messages = await ChatMessage.find({
        $or: [
          { senderId: customerId, receiverType: "Employee", department },
          { receiverId: customerId, receiverType: "Employee", department },
        ],
      })
        .sort({ createdAt: 1 })
        .populate("senderId", "fullName email")
        .populate("receiverId", "fullName email");

      res.json({ success: true, messages });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch messages" });
    }
  });

  // =====================================================
  // SEND message
  // =====================================================
  router.post("/send", async (req, res) => {
    try {
      const { senderId, receiverId, message, senderType, department } = req.body;

      if (!senderId || !receiverId || !message || !senderType || !department) {
        return res
          .status(400)
          .json({ success: false, message: "Missing fields" });
      }

      const newMessage = await ChatMessage.create({
        senderId,
        receiverId,
        senderType, // "User" or "Employee"
        receiverType: senderType === "User" ? "Employee" : "User",
        message,
        read: false,
        department,
      });

      // Emit message to department room (everyone in the department receives it)
      io.to(department).emit("newMessage", newMessage);

      res.status(201).json({ success: true, message: newMessage });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Failed to send message" });
    }
  });

  // =====================================================
  // EMPLOYEE INBOX BY DEPARTMENT
  // Shows all conversations for a department
  // =====================================================
  router.get("/inbox/department/:department", async (req, res) => {
    try {
      const { department } = req.params;

      const messages = await ChatMessage.find({
        receiverType: "Employee",
        department,
      })
        .sort({ createdAt: -1 }) // newest first
        .populate("senderId", "fullName email")
        .populate("receiverId", "fullName email");

      const inboxMap = {};

      messages.forEach((msg) => {
        // The customer is always the User in this system
        const customer = msg.senderType === "User" ? msg.senderId : msg.receiverId;

        if (!customer) return;
        const customerId = customer._id.toString();

        if (!inboxMap[customerId]) {
          inboxMap[customerId] = {
            _id: customer._id,
            fullName: customer.fullName,
            email: customer.email,
            lastMessage: msg.message,
            lastAt: msg.createdAt,
            unreadCount: 0,
          };
        }

        // Count unread messages sent TO this department
        if (
          msg.receiverType === "Employee" &&
          msg.department === department &&
          !msg.read
        ) {
          inboxMap[customerId].unreadCount += 1;
        }
      });

      res.json({
        success: true,
        inbox: Object.values(inboxMap),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load inbox" });
    }
  });

  // =====================================================
  // MARK MESSAGES AS READ BY DEPARTMENT
  // =====================================================
  router.patch("/read/department/:department/:customerId", async (req, res) => {
    try {
      const { department, customerId } = req.params;

      await ChatMessage.updateMany(
        {
          senderId: customerId,
          receiverType: "Employee",
          department,
          read: false,
        },
        { $set: { read: true } }
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  return router;
};
