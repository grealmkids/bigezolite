import { Router } from 'express';
import * as staffController from '../../services/staff/staff.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Staff CRUD
router.post('/', staffController.createStaff);
router.get('/', staffController.getStaff);
router.get('/:id', staffController.getStaffById);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);
router.post('/:id/photo', upload.single('file'), staffController.uploadStaffPhoto);

export default router;
