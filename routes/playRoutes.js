// routes/playRoutes.js
import express from "express";
import Play from "../models/Play.js";
import Actor from "../models/Actor.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(path.resolve(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Serve uploaded images statically
router.use("/uploads", express.static(uploadDir));

// -----------------
// GET all plays
router.get("/", async (req, res) => {
  try {
    const plays = await Play.find()
      .sort({ date: 1 })
      .populate("actors.actor")
      .populate("materialRequests.actor");
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single play by ID
router.get("/:id", async (req, res) => {
  try {
    const play = await Play.findById(req.params.id)
      .populate("actors.actor")
      .populate("materialRequests.actor");
    if (!play) return res.status(404).json({ message: "Play not found" });
    res.json(play);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new play with optional image upload
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { 
      title, 
      description, 
      date, 
      venue, 
      regularPrice, 
      vipPrice, 
      vvipPrice 
    } = req.body;

    // Validate required fields
    if (!title || !description || !date || !venue) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate pricing fields
    if (!regularPrice || !vipPrice || !vvipPrice) {
      return res.status(400).json({ error: "All pricing fields are required" });
    }

    // Convert prices to numbers
    const regular = parseFloat(regularPrice);
    const vip = parseFloat(vipPrice);
    const vvip = parseFloat(vvipPrice);

    // Validate numeric values
    if (isNaN(regular) || isNaN(vip) || isNaN(vvip)) {
      return res.status(400).json({ error: "Prices must be valid numbers" });
    }

    // Optional: Validate price hierarchy
    if (regular >= vip || vip >= vvip) {
      return res.status(400).json({ 
        error: "Prices should follow hierarchy: Regular < VIP < VVIP" 
      });
    }

    const existing = await Play.findOne({ title });
    if (existing) {
      return res.status(400).json({ error: "Play with this title already exists" });
    }

    let image = "";
    if (req.file) {
      image = `/uploads/${req.file.filename}`; // Store relative path in DB
    }

    const newPlay = new Play({ 
      title, 
      description, 
      date, 
      venue, 
      regularPrice: regular,
      vipPrice: vip,
      vvipPrice: vvip,
      image 
    });
    
    await newPlay.save();

    res.status(201).json(newPlay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a play (with optional new image)
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { 
      title, 
      description, 
      date, 
      venue, 
      regularPrice, 
      vipPrice, 
      vvipPrice 
    } = req.body;
    
    const updateData = { title, description, date, venue };

    // Add pricing fields if provided
    if (regularPrice !== undefined) {
      updateData.regularPrice = parseFloat(regularPrice);
    }
    if (vipPrice !== undefined) {
      updateData.vipPrice = parseFloat(vipPrice);
    }
    if (vvipPrice !== undefined) {
      updateData.vvipPrice = parseFloat(vvipPrice);
    }

    // Validate price hierarchy if all prices are being updated
    if (regularPrice !== undefined && vipPrice !== undefined && vvipPrice !== undefined) {
      const regular = parseFloat(regularPrice);
      const vip = parseFloat(vipPrice);
      const vvip = parseFloat(vvipPrice);
      
      if (regular >= vip || vip >= vvip) {
        return res.status(400).json({ 
          error: "Prices should follow hierarchy: Regular < VIP < VVIP" 
        });
      }
    }

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedPlay = await Play.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!updatedPlay) return res.status(404).json({ message: "Play not found" });
    res.json(updatedPlay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a play
router.delete("/:id", async (req, res) => {
  try {
    await Play.findByIdAndDelete(req.params.id);
    res.json({ message: "Play deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST assign actors to a play
router.post("/:id/assign-actors", async (req, res) => {
  try {
    const { actors } = req.body; // array of { actor, role }
    const play = await Play.findById(req.params.id);
    if (!play) return res.status(404).json({ message: "Play not found" });

    const actorIds = actors.map((a) => a.actor);
    const validActors = await Actor.find({ _id: { $in: actorIds }, status: "Active" });
    const validActorIds = validActors.map((a) => a._id.toString());

    const validActorsWithRole = actors.filter((a) => validActorIds.includes(a.actor));

    play.actors = validActorsWithRole;
    await play.save();

    const updatedPlay = await Play.findById(req.params.id).populate("actors.actor");
    res.json(updatedPlay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH approve a material request
router.patch("/:playId/material-requests/:requestId/approve", async (req, res) => {
  try {
    const { playId, requestId } = req.params;
    const play = await Play.findById(playId).populate("materialRequests.actor");
    if (!play) return res.status(404).json({ message: "Play not found" });

    const request = play.materialRequests.id(requestId);
    if (!request) return res.status(404).json({ message: "Material request not found" });

    request.status = "approved";
    request.approvedAt = new Date();
    await play.save();
    res.json({ message: "Material request approved", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark material request as processing
router.patch("/:playId/material-requests/:requestId/processing", async (req, res) => {
  try {
    const { playId, requestId } = req.params;
    const play = await Play.findById(playId).populate("materialRequests.actor");
    if (!play) return res.status(404).json({ message: "Play not found" });

    const request = play.materialRequests.id(requestId);
    if (!request) return res.status(404).json({ message: "Material request not found" });

    // Check if request is approved before marking as processing
    if (request.status !== "approved") {
      return res.status(400).json({ 
        message: "Material request must be approved before processing" 
      });
    }

    request.status = "processing";
    request.processingAt = new Date();
    await play.save();
    res.json({ 
      message: "Material request marked as processing", 
      request 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark material request as prepared
router.patch("/:playId/material-requests/:requestId/prepare", async (req, res) => {
  try {
    const { playId, requestId } = req.params;
    const play = await Play.findById(playId).populate("materialRequests.actor");
    if (!play) return res.status(404).json({ message: "Play not found" });

    const request = play.materialRequests.id(requestId);
    if (!request) return res.status(404).json({ message: "Material request not found" });

    // Check if request is in processing before marking as prepared
    if (request.status !== "processing") {
      return res.status(400).json({ 
        message: "Material request must be in processing before marking as prepared" 
      });
    }

    request.status = "prepared";
    request.preparedAt = new Date();
    await play.save();
    res.json({ 
      message: "Material request marked as prepared", 
      request 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH reject a material request
router.patch("/:playId/material-requests/:requestId/reject", async (req, res) => {
  try {
    const { playId, requestId } = req.params;
    const play = await Play.findById(playId).populate("materialRequests.actor");
    if (!play) return res.status(404).json({ message: "Play not found" });

    const request = play.materialRequests.id(requestId);
    if (!request) return res.status(404).json({ message: "Material request not found" });

    request.status = "rejected";
    request.rejectedAt = new Date();
    await play.save();
    res.json({ message: "Material request rejected", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET plays with specific price range (optional endpoint)
router.get("/price/range", async (req, res) => {
  try {
    const { min, max, type } = req.query;
    
    let filter = {};
    
    if (min && max) {
      if (type === 'regular') {
        filter.regularPrice = { $gte: parseFloat(min), $lte: parseFloat(max) };
      } else if (type === 'vip') {
        filter.vipPrice = { $gte: parseFloat(min), $lte: parseFloat(max) };
      } else if (type === 'vvip') {
        filter.vvipPrice = { $gte: parseFloat(min), $lte: parseFloat(max) };
      } else {
        filter.$or = [
          { regularPrice: { $gte: parseFloat(min), $lte: parseFloat(max) } },
          { vipPrice: { $gte: parseFloat(min), $lte: parseFloat(max) } },
          { vvipPrice: { $gte: parseFloat(min), $lte: parseFloat(max) } }
        ];
      }
    }
    
    const plays = await Play.find(filter).sort({ date: 1 });
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cheapest/most expensive plays (optional endpoint)
router.get("/price/cheapest", async (req, res) => {
  try {
    const plays = await Play.find().sort({ regularPrice: 1 }).limit(10);
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/price/most-expensive", async (req, res) => {
  try {
    const plays = await Play.find().sort({ vvipPrice: -1 }).limit(10);
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all approved material requests (for inventory dashboard)
router.get("/materials/approved", async (req, res) => {
  try {
    const plays = await Play.find()
      .populate("materialRequests.actor")
      .select("title description materialRequests");
    
    // Filter plays that have approved material requests
    const playsWithApprovedMaterials = plays.filter(play => 
      play.materialRequests.some(req => req.status === "approved")
    );
    
    res.json(playsWithApprovedMaterials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all processing material requests
router.get("/materials/processing", async (req, res) => {
  try {
    const plays = await Play.find()
      .populate("materialRequests.actor")
      .select("title description materialRequests");
    
    // Filter plays that have processing material requests
    const playsWithProcessingMaterials = plays.filter(play => 
      play.materialRequests.some(req => req.status === "processing")
    );
    
    res.json(playsWithProcessingMaterials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all prepared material requests
router.get("/materials/prepared", async (req, res) => {
  try {
    const plays = await Play.find()
      .populate("materialRequests.actor")
      .select("title description materialRequests");
    
    // Filter plays that have prepared material requests
    const playsWithPreparedMaterials = plays.filter(play => 
      play.materialRequests.some(req => req.status === "prepared")
    );
    
    res.json(playsWithPreparedMaterials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET material request statistics
router.get("/materials/stats", async (req, res) => {
  try {
    const plays = await Play.find().populate("materialRequests.actor");
    
    const stats = {
      totalRequests: 0,
      approved: 0,
      processing: 0,
      prepared: 0,
      rejected: 0,
      pending: 0,
      byPlay: []
    };
    
    plays.forEach(play => {
      const playStats = {
        playId: play._id,
        playTitle: play.title,
        total: play.materialRequests.length,
        approved: 0,
        processing: 0,
        prepared: 0,
        rejected: 0,
        pending: 0
      };
      
      play.materialRequests.forEach(req => {
        stats.totalRequests++;
        playStats[req.status || "pending"]++;
        stats[req.status || "pending"]++;
      });
      
      if (play.materialRequests.length > 0) {
        stats.byPlay.push(playStats);
      }
    });
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST submit a material request (for actors)
router.post("/:playId/material-requests", async (req, res) => {
  try {
    const { playId } = req.params;
    const { actorId, materials } = req.body;
    
    if (!actorId || !materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: "Actor ID and materials array are required" });
    }
    
    const play = await Play.findById(playId);
    if (!play) return res.status(404).json({ message: "Play not found" });
    
    // Check if actor is assigned to this play
    const isActorAssigned = play.actors.some(assignedActor => 
      assignedActor.actor.toString() === actorId
    );
    
    if (!isActorAssigned) {
      return res.status(400).json({ 
        message: "Actor is not assigned to this play" 
      });
    }
    
    // Check if actor already has a pending request for this play
    const existingRequest = play.materialRequests.find(request => 
      request.actor.toString() === actorId && 
      (!request.status || request.status === "pending")
    );
    
    if (existingRequest) {
      return res.status(400).json({ 
        message: "Actor already has a pending material request for this play" 
      });
    }
    
    // Add new material request
    play.materialRequests.push({
      actor: actorId,
      materials: materials,
      status: "pending",
      requestedAt: new Date()
    });
    
    await play.save();
    
    const updatedPlay = await Play.findById(playId).populate("materialRequests.actor");
    const newRequest = updatedPlay.materialRequests[updatedPlay.materialRequests.length - 1];
    
    res.status(201).json({
      message: "Material request submitted successfully",
      request: newRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In routes/playRoutes.js, update the collect endpoint:
router.patch("/:playId/material-requests/:requestId/collect", async (req, res) => {
  try {
    const { playId, requestId } = req.params;
    
    console.log("Collect endpoint called for play:", playId, "request:", requestId);
    
    const play = await Play.findById(playId);
    if (!play) {
      return res.status(404).json({ 
        success: false,
        message: "Play not found" 
      });
    }

    const request = play.materialRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ 
        success: false,
        message: "Material request not found" 
      });
    }

    console.log("Current request status:", request.status);
    
    // Check if request is prepared
    if (request.status !== "prepared") {
      return res.status(400).json({ 
        success: false,
        message: `Material request must be prepared before marking as collected. Current status: ${request.status}` 
      });
    }

    // Update to collected
    request.status = "collected";
    request.collectedAt = new Date();
    
    console.log("Updating to collected, saving...");
    
    try {
      await play.save();
      console.log("Save successful");
      
      res.json({ 
        success: true,
        message: "Material request marked as collected", 
        request: {
          _id: request._id,
          status: request.status,
          collectedAt: request.collectedAt,
          materials: request.materials
        }
      });
    } catch (saveError) {
      console.error("Save error:", saveError.message);
      
      // Check if it's a validation error
      if (saveError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: "Validation error. Make sure 'collected' is in the status enum in Play model.",
          error: saveError.message
        });
      }
      
      throw saveError;
    }
    
  } catch (err) {
    console.error("Collect error:", err.message);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

export default router;