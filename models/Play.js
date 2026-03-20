// models/Play.js
import mongoose from "mongoose";

const playSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  image: { type: String, default: "" }, // stores relative path: e.g., "uploads/abc123.jpg"
  createdAt: { type: Date, default: Date.now },

  // Ticket Pricing
  regularPrice: { type: Number, required: true, default: 0 },
  vipPrice: { type: Number, required: true, default: 0 },
  vvipPrice: { type: Number, required: true, default: 0 },

  // List of actors assigned to the play
  actors: [
    {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "Actor", required: true },
      role: { type: String, required: true },
      status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
      confirmed: { type: Boolean, default: false } // Actor confirms availability
    }
  ],

  // Material requests by actors
  materialRequests: [
    {
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "Actor", required: true },
      materials: [
        {
          name: { type: String, required: true },
          quantity: { type: Number, default: 1 },
          unit: { type: String, default: "pcs" } // Added unit field
        }
      ],
      requestedAt: { type: Date, default: Date.now },
      status: { 
        type: String, 
        enum: ["pending", "approved", "rejected", "processing", "prepared", "collected"], // ADDED "collected"
        default: "pending" 
      },
      // Timestamps for each status change
      approvedAt: { type: Date },
      processingAt: { type: Date },
      preparedAt: { type: Date },
      collectedAt: { type: Date }, // ADDED collectedAt field
      rejectedAt: { type: Date },
      
      // Inventory tracking
      inventoryChecked: { type: Boolean, default: false },
      inventoryAvailable: { type: Boolean, default: false },
      preparedBy: { type: String }, // Name of inventory manager who prepared
      notes: { type: String } // Any additional notes
    }
  ]
});

// Indexes for better query performance
playSchema.index({ title: 1 });
playSchema.index({ date: 1 });
playSchema.index({ venue: 1 });
playSchema.index({ "materialRequests.status": 1 });
playSchema.index({ "materialRequests.actor": 1 });

// Virtual field to get full image URL if needed
playSchema.virtual("imageUrl").get(function () {
  if (!this.image) return null;
  return `${process.env.SERVER_URL || "https://fanaka-server-1.onrender.com"}${this.image}`;
});

// Virtual for formatted date
playSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for getting only approved material requests
playSchema.virtual("approvedMaterials").get(function () {
  return this.materialRequests.filter(req => req.status === "approved");
});

// Virtual for getting only processing material requests
playSchema.virtual("processingMaterials").get(function () {
  return this.materialRequests.filter(req => req.status === "processing");
});

// Virtual for getting only prepared material requests
playSchema.virtual("preparedMaterials").get(function () {
  return this.materialRequests.filter(req => req.status === "prepared");
});

// Virtual for getting only collected material requests
playSchema.virtual("collectedMaterials").get(function () { // ADDED this virtual
  return this.materialRequests.filter(req => req.status === "collected");
});

// Virtual for getting total material requests count by status
playSchema.virtual("materialStats").get(function () {
  const stats = {
    total: this.materialRequests.length,
    pending: 0,
    approved: 0,
    processing: 0,
    prepared: 0,
    collected: 0, // ADDED collected count
    rejected: 0
  };
  
  this.materialRequests.forEach(req => {
    if (stats[req.status] !== undefined) {
      stats[req.status]++;
    }
  });
  
  return stats;
});

// Method to add a material request
playSchema.methods.addMaterialRequest = function(actorId, materials) {
  this.materialRequests.push({
    actor: actorId,
    materials: materials,
    status: "pending",
    requestedAt: new Date()
  });
};

// Method to update material request status - UPDATED to include collected
playSchema.methods.updateMaterialRequestStatus = function(requestId, status, preparedBy = null, notes = null) {
  const request = this.materialRequests.id(requestId);
  if (request) {
    const previousStatus = request.status;
    request.status = status;
    
    // Update timestamp based on status
    const now = new Date();
    switch(status) {
      case "approved":
        request.approvedAt = now;
        break;
      case "processing":
        request.processingAt = now;
        break;
      case "prepared":
        request.preparedAt = now;
        request.preparedBy = preparedBy;
        break;
      case "collected": // ADDED collected case
        request.collectedAt = now;
        break;
      case "rejected":
        request.rejectedAt = now;
        break;
    }
    
    if (notes) {
      request.notes = notes;
    }
    
    return { success: true, previousStatus, newStatus: status };
  }
  return { success: false, error: "Material request not found" };
};

// Method to check if actor is assigned to this play
playSchema.methods.isActorAssigned = function(actorId) {
  return this.actors.some(assignedActor => 
    assignedActor.actor.toString() === actorId.toString()
  );
};

// Method to get actor's material requests
playSchema.methods.getActorMaterialRequests = function(actorId) {
  return this.materialRequests.filter(req => 
    req.actor.toString() === actorId.toString()
  );
};

// Method to get all material names from all requests (for inventory check)
playSchema.methods.getAllMaterialNames = function() {
  const materialNames = new Set();
  this.materialRequests.forEach(req => {
    req.materials.forEach(material => {
      materialNames.add(material.name.toLowerCase());
    });
  });
  return Array.from(materialNames);
};

// Method to get total quantity of a specific material
playSchema.methods.getMaterialTotalQuantity = function(materialName) {
  let total = 0;
  const searchName = materialName.toLowerCase();
  
  this.materialRequests.forEach(req => {
    req.materials.forEach(material => {
      if (material.name.toLowerCase() === searchName) {
        total += material.quantity || 1;
      }
    });
  });
  
  return total;
};

// Static method to find plays with material requests by status - UPDATED
playSchema.statics.findByMaterialStatus = function(status) {
  return this.find({ "materialRequests.status": status })
    .populate("actors.actor")
    .populate("materialRequests.actor");
};

// Static method to get material statistics across all plays - UPDATED
playSchema.statics.getMaterialStats = async function() {
  const stats = {
    totalRequests: 0,
    pending: 0,
    approved: 0,
    processing: 0,
    prepared: 0,
    collected: 0, // ADDED collected
    rejected: 0,
    playsWithRequests: 0
  };
  
  const plays = await this.find().populate("materialRequests.actor");
  
  plays.forEach(play => {
    if (play.materialRequests.length > 0) {
      stats.playsWithRequests++;
      play.materialRequests.forEach(req => {
        stats.totalRequests++;
        if (stats[req.status] !== undefined) {
          stats[req.status]++;
        }
      });
    }
  });
  
  return stats;
};

// NEW: Method to mark a material request as collected
playSchema.methods.markAsCollected = function(requestId) {
  const request = this.materialRequests.id(requestId);
  if (request) {
    // Check if request is prepared
    if (request.status !== "prepared") {
      return { 
        success: false, 
        error: `Request must be prepared before marking as collected. Current status: ${request.status}` 
      };
    }
    
    const previousStatus = request.status;
    request.status = "collected";
    request.collectedAt = new Date();
    
    return { 
      success: true, 
      previousStatus, 
      newStatus: "collected",
      request 
    };
  }
  return { success: false, error: "Material request not found" };
};

// NEW: Static method to get collected material requests for an actor
playSchema.statics.getCollectedRequestsForActor = async function(actorId) {
  const plays = await this.find({
    "materialRequests.actor": actorId,
    "materialRequests.status": "collected"
  })
  .populate("actors.actor")
  .populate("materialRequests.actor");
  
  const collectedRequests = [];
  plays.forEach(play => {
    play.materialRequests.forEach(req => {
      if (req.actor.toString() === actorId.toString() && req.status === "collected") {
        collectedRequests.push({
          play: {
            _id: play._id,
            title: play.title,
            date: play.date,
            venue: play.venue
          },
          request: req
        });
      }
    });
  });
  
  return collectedRequests;
};

const Play = mongoose.model("Play", playSchema);
export default Play;