import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as feesToTrackController from '../../services/feesToTrack/feesToTrack.controller';

const router = Router();
router.use(authenticateToken);

// List fees to track for a school
router.get('/', feesToTrackController.listFees);
// Create a new fee to track and apply to students
router.post('/', feesToTrackController.createFee);
// Update a fee (limited fields)
router.put('/:feeId', feesToTrackController.updateFee);
// Delete a fee (cascade deletes fee_records)
router.delete('/:feeId', feesToTrackController.deleteFee);

export default router;
