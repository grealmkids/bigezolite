import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import * as feesToTrackService from './feesToTrack.service';
import { verifyUserSchoolAccess } from '../students/student.service';

export const listFees = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
    const schoolId = schoolIdFromQuery || req.user?.schoolId;
    if (!userId || !schoolId) return res.status(400).json({ message: 'Missing or invalid auth/school' });
    const access = await verifyUserSchoolAccess(userId, schoolId);
    if (!access) return res.status(403).json({ message: 'Forbidden' });
    const items = await feesToTrackService.listFeesToTrack(schoolId);
    res.status(200).json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createFee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const schoolIdFromQuery = req.query.schoolId ? Number(req.query.schoolId) : null;
    const schoolId = schoolIdFromQuery || req.user?.schoolId;
    if (!userId || !schoolId) return res.status(400).json({ message: 'Missing or invalid auth/school' });
    const access = await verifyUserSchoolAccess(userId, schoolId);
    if (!access) return res.status(403).json({ message: 'Forbidden' });

    const payload = req.body || {};
    const created = await feesToTrackService.createFeeToTrackAndApply(schoolId, payload);
    res.status(201).json(created);
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ message: e?.message || 'Failed to create fee' });
  }
};

export const updateFee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const feeId = Number(req.params.feeId);
    if (!userId || !feeId) return res.status(400).json({ message: 'Missing parameters' });
    const updated = await feesToTrackService.updateFeeToTrack(feeId, req.body || {}, userId);
    res.status(200).json(updated);
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ message: e?.message || 'Failed to update fee' });
  }
};

export const getFee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const feeId = Number(req.params.feeId);
    if (!userId || !feeId) return res.status(400).json({ message: 'Missing parameters' });
    const fee = await feesToTrackService.findFeeToTrackById(feeId);
    if (!fee) return res.status(404).json({ message: 'Not found' });
    const access = await verifyUserSchoolAccess(userId, fee.school_id);
    if (!access) return res.status(403).json({ message: 'Forbidden' });
    res.status(200).json(fee);
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ message: e?.message || 'Failed to fetch fee' });
  }
};

export const deleteFee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const feeId = Number(req.params.feeId);
    if (!userId || !feeId) return res.status(400).json({ message: 'Missing parameters' });
    await feesToTrackService.deleteFeeToTrack(feeId, userId);
    res.status(200).json({ message: 'Fee deleted' });
  } catch (e:any) {
    console.error(e);
    res.status(400).json({ message: e?.message || 'Failed to delete fee' });
  }
};
