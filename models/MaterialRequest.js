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
      type: String,
      required: true
    }
  ],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema);

export default MaterialRequest;
