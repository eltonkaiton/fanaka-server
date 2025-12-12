// controllers/materialRequestController.js
import MaterialRequest from '../models/MaterialRequest.js';

export const approveMaterialRequest = async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = 'approved';
    await request.save();
    res.json({ message: 'Material request approved', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectMaterialRequest = async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = 'rejected';
    await request.save();
    res.json({ message: 'Material request rejected', request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
