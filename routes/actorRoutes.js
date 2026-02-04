// routes/actorRoutes.js
import express from "express";
import { 
  addActor,
  getActors,
  getActorById,
  updateActor,
  deleteActor,
  loginActor,
  getActorDashboard,
  confirmPlay,
  requestMaterials,
  markMaterialsCollected // ✅ NEW
} from "../controllers/actorController.js";

const router = express.Router();

// ------------------ ACTORS CRUD ------------------
router.post("/", addActor);
router.get("/", getActors);
router.get("/:id", getActorById);
router.put("/:id", updateActor);
router.delete("/:id", deleteActor);

// ------------------ AUTH ------------------
router.post("/login", loginActor);

// ------------------ DASHBOARD ------------------
router.get("/:id/dashboard", getActorDashboard);

// ------------------ PLAY ACTIONS ------------------
router.patch("/:playId/confirm", confirmPlay);
router.post("/:playId/request-materials", requestMaterials);

// ------------------ MATERIAL COLLECTION ------------------
router.patch(
  "/request/:requestId/collect",
  markMaterialsCollected
);

export default router;
