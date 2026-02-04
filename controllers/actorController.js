import Actor from "../models/Actor.js";
import Play from "../models/Play.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// --------------------- CRUD ---------------------

export const addActor = async (req, res) => {
  try {
    const { fullName, stageName, role, email, phone, password, status } = req.body;

    const existingActor = await Actor.findOne({ email });
    if (existingActor) {
      return res.status(400).json({ message: "Actor with this email already exists" });
    }

    const actor = new Actor({ fullName, stageName, role, email, phone, password, status });
    await actor.save();

    res.status(201).json({ message: "Actor added successfully", actor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getActors = async (req, res) => {
  try {
    const actors = await Actor.find().sort({ createdAt: -1 });
    res.status(200).json(actors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getActorById = async (req, res) => {
  try {
    const actor = await Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: "Actor not found" });
    res.status(200).json(actor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateActor = async (req, res) => {
  try {
    const { fullName, stageName, role, email, phone, password, status } = req.body;

    const actor = await Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: "Actor not found" });

    actor.fullName = fullName || actor.fullName;
    actor.stageName = stageName || actor.stageName;
    actor.role = role || actor.role;
    actor.email = email || actor.email;
    actor.phone = phone || actor.phone;
    actor.status = status || actor.status;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      actor.password = await bcrypt.hash(password, salt);
    }

    await actor.save();
    res.status(200).json({ message: "Actor updated successfully", actor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteActor = async (req, res) => {
  try {
    const actor = await Actor.findById(req.params.id);
    if (!actor) return res.status(404).json({ message: "Actor not found" });

    await actor.deleteOne();
    res.status(200).json({ message: "Actor deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// --------------------- LOGIN ---------------------

export const loginActor = async (req, res) => {
  try {
    const { email, password } = req.body;

    const actor = await Actor.findOne({ email });
    if (!actor) return res.status(400).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, actor.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid email or password" });

    if (actor.status !== "Active") {
      return res.status(403).json({ error: "Your account is inactive. Contact admin." });
    }

    const token = jwt.sign(
      { id: actor._id, role: actor.role },
      "SECRET_KEY_123",
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      actor: {
        _id: actor._id,
        fullName: actor.fullName,
        stageName: actor.stageName,
        role: actor.role,
        email: actor.email,
        phone: actor.phone,
        status: actor.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// --------------------- DASHBOARD ---------------------

export const getActorDashboard = async (req, res) => {
  try {
    const actorId = req.params.id;

    const actor = await Actor.findById(actorId);
    if (!actor) return res.status(404).json({ message: "Actor not found" });

    const plays = await Play.find({
      "actors.actor": actorId,
      "actors.status": "Active"
    }).lean();

    const assignedPlays = plays.map(play => {
      const actorInfo = play.actors.find(
        a => a.actor.toString() === actorId.toString()
      );

      return {
        ...play,
        role: actorInfo?.role || "N/A",
        confirmed: actorInfo?.confirmed || false
      };
    });

    res.status(200).json({
      actor,
      plays: assignedPlays
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// --------------------- CONFIRM PLAY ---------------------

export const confirmPlay = async (req, res) => {
  try {
    const { playId } = req.params;
    const { actorId } = req.body;

    const play = await Play.findById(playId);
    if (!play) return res.status(404).json({ message: "Play not found" });

    const actorEntry = play.actors.find(
      a => a.actor.toString() === actorId.toString()
    );

    if (!actorEntry) {
      return res.status(404).json({ message: "Actor not assigned to this play" });
    }

    actorEntry.confirmed = true;
    await play.save();

    res.status(200).json({ message: "Play confirmed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// --------------------- REQUEST MATERIALS ---------------------

export const requestMaterials = async (req, res) => {
  try {
    const { actorId, materials } = req.body;
    const { playId } = req.params;

    if (!actorId || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ message: "Actor ID and materials are required" });
    }

    const play = await Play.findById(playId);
    if (!play) return res.status(404).json({ message: "Play not found" });

    if (!play.materialRequests) play.materialRequests = [];

    play.materialRequests.push({
      actor: actorId,
      materials,
      status: "pending",      // ✅ FIXED
      requestedAt: new Date(),
      updatedAt: new Date()
    });

    await play.save();

    res.status(200).json({ message: "Material request sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ------------------ MARK MATERIALS AS COLLECTED ------------------

export const markMaterialsCollected = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { actorId } = req.body;

    if (!actorId) return res.status(400).json({ message: "Actor ID is required" });

    // Find play containing this request
    const play = await Play.findOne({
      "materialRequests._id": requestId
    });

    if (!play) return res.status(404).json({ message: "Material request not found" });

    // Find request
    const request = play.materialRequests.id(requestId);

    if (!request) return res.status(404).json({ message: "Request not found" });

    // Make sure actor field exists
    if (!request.actor) return res.status(400).json({ message: "Request actor is missing" });

    // Validate actor
    if (request.actor.toString() !== actorId.toString()) {
      return res.status(403).json({ message: "Unauthorized actor" });
    }

    // Validate status
    if (request.status !== "prepared") {
      return res.status(400).json({ message: "Items are not prepared yet" });
    }

    request.status = "collected";
    request.updatedAt = new Date();

    await play.save();

    res.status(200).json({ message: "Items marked as collected successfully" });
  } catch (error) {
    console.error("Collect error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
