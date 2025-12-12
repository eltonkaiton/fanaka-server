// routes/plays.js
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
    const { title, description, date, venue } = req.body;

    const existing = await Play.findOne({ title });
    if (existing)
      return res.status(400).json({ error: "Play with this title already exists" });

    let image = "";
    if (req.file) {
      image = `/uploads/${req.file.filename}`; // Store relative path in DB
    }

    const newPlay = new Play({ title, description, date, venue, image });
    await newPlay.save();

    res.status(201).json(newPlay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a play (with optional new image)
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, description, date, venue } = req.body;
    const updateData = { title, description, date, venue };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const updatedPlay = await Play.findByIdAndUpdate(req.params.id, updateData, { new: true });
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
    await play.save();
    res.json({ message: "Material request approved", request });
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
    await play.save();
    res.json({ message: "Material request rejected", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
