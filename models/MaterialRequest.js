// models/MaterialRequest.js - UPDATE THIS
import mongoose from 'mongoose';

const materialRequestSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Actor',
    required: true
  },
  play: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Play',
    required: true
  },
  materials: [
    {
      type: String, // Consider changing to { name: String, quantity: Number }
      required: true
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'prepared', 'collected'], // ADD 'prepared' and 'collected'
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  preparedAt: { type: Date }, // ADD THIS
  collectedAt: { type: Date }  // ADD THIS
});

const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema);

export default MaterialRequest;