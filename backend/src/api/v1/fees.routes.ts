
import { Router } from 'express';
import * as feesController from '../../services/fees/fees.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// All fees routes are protected
router.use(authenticateToken);

// PUT /api/v1/fees/:feeRecordId - Update a fee record
router.put('/:feeRecordId', feesController.updateFeeRecord);

export default router;
