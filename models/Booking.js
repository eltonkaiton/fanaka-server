import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  playId: { type: mongoose.Schema.Types.ObjectId, ref: 'Play', required: true },
  playTitle: { type: String, required: true },
  bookingReference: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, default: '' },
  ticketType: { type: String, enum: ['regular', 'vip', 'vvip'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  allocatedSeats: [{ type: String, required: true }],
  totalPrice: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, required: true, default: 'manual' },
  paymentCode: { type: String, required: true },
  paymentStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  playDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'checked_in', 'completed'], // ✅ ADDED 'checked_in' and 'completed'
    default: 'pending' 
  },
  bookingDate: { type: Date, default: Date.now },
  // ✅ ADDED CHECK-IN FIELDS
  checkedIn: { type: Boolean, default: false },
  checkInTime: { type: Date, default: null },
  checkedBy: { type: String, default: null } // usher/attendant who checked in
}, { timestamps: true });

bookingSchema.index({ customerEmail: 1, bookingDate: -1 });
bookingSchema.index({ bookingReference: 1 });
bookingSchema.index({ playId: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkedIn: 1 }); // ✅ ADDED index for check-in queries

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;