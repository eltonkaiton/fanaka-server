// routes/materialRequests.js
import express from 'express';
import MaterialRequest from '../models/MaterialRequest.js';
import { 
  approveMaterialRequest, 
  rejectMaterialRequest,
  prepareMaterialRequest,
  collectMaterialRequest 
} from '../controllers/materialRequestController.js';

const router = express.Router();

// GET all material requests
router.get('/', async (req, res) => {
  try {
    const requests = await MaterialRequest.find()
      .populate('actor', 'fullName email')
      .populate('play', 'title date venue');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE material request
router.post('/', async (req, res) => {
  try {
    const { actor, play, materials } = req.body;
    
    const newRequest = new MaterialRequest({
      actor,
      play,
      materials,
      status: 'pending'
    });
    
    await newRequest.save();
    
    await newRequest.populate('actor', 'fullName email');
    await newRequest.populate('play', 'title date venue');
    
    res.status(201).json(newRequest);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET requests by actor
router.get('/actor/:actorId', async (req, res) => {
  try {
    const { actorId } = req.params;
    
    const requests = await MaterialRequest.find({ actor: actorId })
      .populate('play', 'title date venue');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET requests by play
router.get('/play/:playId', async (req, res) => {
  try {
    const { playId } = req.params;
    
    const requests = await MaterialRequest.find({ play: playId })
      .populate('actor', 'fullName email');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve material request
router.patch('/:id/approve', approveMaterialRequest);

// Reject material request
router.patch('/:id/reject', rejectMaterialRequest);

// MARK AS PREPARED
router.patch('/:id/prepare', prepareMaterialRequest);

// MARK AS COLLECTED
router.patch('/:id/collect', collectMaterialRequest);

export default router;