// server/models/ChatMessage.js
import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "senderType", // can be 'User' or 'Employee'
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "receiverType", // can be 'User' or 'Employee'
    },

    senderType: {
      type: String,
      required: true,
      enum: ["User", "Employee"],
      set: (value) => {
        if (!value) return value;
        const v = value.toLowerCase();
        if (v === "user" || v === "customer") return "User";
        if (v === "employee") return "Employee";
        return value;
      },
    },

    receiverType: {
      type: String,
      required: true,
      enum: ["User", "Employee"],
      set: (value) => {
        if (!value) return value;
        const v = value.toLowerCase();
        if (v === "user" || v === "customer") return "User";
        if (v === "employee") return "Employee";
        return value;
      },
    },

    department: {
      type: String,
      required: function () {
        // department required if receiver is Employee
        return this.receiverType === "Employee";
      },
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for faster queries by department
chatMessageSchema.index({ department: 1, receiverType: 1, createdAt: -1 });

export default mongoose.model("ChatMessage", chatMessageSchema);
