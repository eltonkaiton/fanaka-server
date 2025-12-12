// routes/materialRequests.js
import express from 'express';
import { approveMaterialRequest, rejectMaterialRequest } from '../controllers/materialRequestController.js';

const router = express.Router();

// Approve material request
router.patch('/:id/approve', approveMaterialRequest);

// Reject material request
router.patch('/:id/reject', rejectMaterialRequest);

export default router;
