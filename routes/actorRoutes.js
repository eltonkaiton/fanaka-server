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
  confirmPlay,  // ✅ make sure this is included
  requestMaterials,
} from "../controllers/actorController.js";

const router = express.Router();

// Example routes
router.post("/", addActor);
router.get("/", getActors);
router.get("/:id", getActorById);
router.put("/:id", updateActor);
router.delete("/:id", deleteActor);
router.post("/login", loginActor);
router.get("/:id/dashboard", getActorDashboard);

// ------------------ CONFIRM PLAY ------------------
router.patch("/:playId/confirm", confirmPlay);
router.post("/:playId/request-materials", requestMaterials);


export default router;
