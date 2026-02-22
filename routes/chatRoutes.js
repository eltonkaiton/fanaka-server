// server/routes/chatRoutes.js

import express from "express";
import ChatMessage from "../models/ChatMessage.js";

export default (io) => {
  const router = express.Router();

  // =====================================================
  // GET MESSAGES (FULL CONVERSATION)
  // =====================================================
  router.get("/messages/department/:department/:customerId", async (req, res) => {
    try {
      const { department, customerId } = req.params;

      const messages = await ChatMessage.find({
        department,
        $or: [
          // User → Employee
          { senderId: customerId, senderType: "User" },

          // Employee → User
          { receiverId: customerId, senderType: "Employee" },
        ],
      })
        .sort({ createdAt: 1 })
        .populate("senderId", "fullName email")
        .populate("receiverId", "fullName email");

      res.json({ success: true, messages });
    } catch (err) {
      console.error("FETCH MESSAGE ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Failed to fetch messages",
      });
    }
  });

  // =====================================================
  // SEND MESSAGE
  // =====================================================
  router.post("/send", async (req, res) => {
    try {
      const { senderId, receiverId, message, senderType, department } =
        req.body;

      if (!senderId || !receiverId || !message || !senderType || !department) {
        return res.status(400).json({
          success: false,
          message: "Missing fields",
        });
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

      // Emit to department room
      io.to(department).emit("newMessage", newMessage);

      res.status(201).json({
        success: true,
        message: newMessage,
      });
    } catch (err) {
      console.error("SEND ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  });

  // =====================================================
  // EMPLOYEE INBOX (PER DEPARTMENT)
  // =====================================================
  router.get("/inbox/department/:department", async (req, res) => {
    try {
      const { department } = req.params;

      const messages = await ChatMessage.find({
        department,
      })
        .sort({ createdAt: -1 })
        .populate("senderId", "fullName email")
        .populate("receiverId", "fullName email");

      const inboxMap = {};

      messages.forEach((msg) => {
        const isUserSender = msg.senderType === "User";
        const customer = isUserSender ? msg.senderId : msg.receiverId;

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

        // Count unread user → employee messages
        if (
          msg.senderType === "User" &&
          msg.receiverType === "Employee" &&
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
      console.error("INBOX ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Failed to load inbox",
      });
    }
  });

  // =====================================================
  // MARK AS READ
  // =====================================================
  router.patch("/read/department/:department/:customerId", async (req, res) => {
    try {
      const { department, customerId } = req.params;

      await ChatMessage.updateMany(
        {
          department,
          senderId: customerId,
          senderType: "User",
          receiverType: "Employee",
          read: false,
        },
        { $set: { read: true } }
      );

      res.json({ success: true });
    } catch (err) {
      console.error("READ ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Failed to mark read",
      });
    }
  });

  return router;
};