// controllers/materialRequestController.js
import MaterialRequest from '../models/MaterialRequest.js';

// Approve material request
export const approveMaterialRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await MaterialRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Material request not found' });
    }
    
    request.status = 'approved';
    request.approvedAt = new Date();
    await request.save();
    
    res.json({ success: true, message: 'Request approved', request });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Reject material request
export const rejectMaterialRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await MaterialRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Material request not found' });
    }
    
    request.status = 'rejected';
    request.rejectedAt = new Date();
    await request.save();
    
    res.json({ success: true, message: 'Request rejected', request });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// MARK AS PREPARED (for inventory/backoffice)
export const prepareMaterialRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await MaterialRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Material request not found' });
    }
    
    // Check if request is approved
    if (request.status !== 'approved') {
      return res.status(400).json({ 
        error: 'Request must be approved before marking as prepared' 
      });
    }
    
    request.status = 'prepared';
    request.preparedAt = new Date();
    await request.save();
    
    res.json({ 
      success: true, 
      message: 'Request marked as prepared', 
      request 
    });
  } catch (error) {
    console.error('Prepare error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// MARK AS COLLECTED (for actors)
export const collectMaterialRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { actorId } = req.body;
    
    const request = await MaterialRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Material request not found' });
    }
    
    // Verify the actor owns this request
    if (request.actor.toString() !== actorId) {
      return res.status(403).json({ 
        error: 'Not authorized to update this request' 
      });
    }
    
    // Check if request is prepared
    if (request.status !== 'prepared') {
      return res.status(400).json({ 
        error: 'Request must be prepared before marking as collected' 
      });
    }
    
    request.status = 'collected';
    request.collectedAt = new Date();
    await request.save();
    
    res.json({ 
      success: true, 
      message: 'Request marked as collected', 
      request 
    });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};