// models/Order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item"
  },
  itemName: String,
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  },
  supplierName: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0.01
  },
  totalCost: {
    type: Number,
    required: true
  },
  description: String,
  estimatedDelivery: Date,
  trackingNumber: String,
  deliveryDate: Date,
  status: {
    type: String,
    enum: ["Pending", "Approved", "Processing", "Delivered", "Received", "Payment Pending", "Paid", "Rejected", "Cancelled"],
    default: "Pending"
  },

  // PAYMENT FIELDS - UPDATED WITH SUPPLIER CONFIRMATION
  payment: {
    status: {
      type: String,
      enum: ["Pending", "Submitted", "Approved", "Paid", "Rejected", "Confirmed"],
      default: "Pending"
    },
    
    // Payment submission by finance/accountant
    submittedBy: {
      id: String,
      name: String
    },
    submittedAt: Date,
    
    // Payment method details
    paymentMethod: {
      type: String,
      enum: ["Bank Transfer", "MPesa", "Cheque", "Cash", "Other"]
    },
    transactionId: String,
    paymentDate: Date,
    
    // Payment approval (optional, for approval workflows)
    approvedBy: {
      id: String,
      name: String
    },
    approvedAt: Date,
    
    // Payment processing (who actually processed the payment)
    processedBy: {
      id: String,
      name: String
    },
    processedAt: Date,
    
    // Payment amount details
    amountPaid: Number,
    paymentProof: String, // URL to payment proof/document
    
    // Supplier confirmation of payment receipt
    supplierConfirmation: {
      type: Boolean,
      default: false
    },
    confirmedBy: {
      id: String,      // Supplier ID who confirmed
      name: String     // Supplier name
    },
    confirmedByName: String, // Alternative field for supplier name
    confirmationDate: Date,
    transactionProof: String, // Proof/reference provided by supplier
    confirmationNotes: String,
    
    // General payment notes
    notes: String
  },

  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee"
  },
  createdByName: String
}, {
  timestamps: true
});

// Indexes for performance
orderSchema.index({ status: 1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "payment.supplierConfirmation": 1 });
orderSchema.index({ supplier: 1 });

// Pre-save middleware to calculate total cost
orderSchema.pre('save', function(next) {
  if (this.quantity && this.unitPrice) {
    this.totalCost = this.quantity * this.unitPrice;
  }
  
  // Update payment amount if not set
  if (this.payment && !this.payment.amountPaid && this.totalCost) {
    this.payment.amountPaid = this.totalCost;
  }
  
  next();
});

export default mongoose.model("Order", orderSchema);