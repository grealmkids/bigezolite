
import { Request, Response } from 'express';
import examSetService from './exam-set.service';

class ExamSetController {
  async createExamSet(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const examSet = await examSetService.createExamSet(req.body, userId);
      res.status(201).json(examSet);
    } catch (error) {
      res.status(500).json({ message: 'Error creating exam set', error });
    }
  }

  async getExamSets(req: Request, res: Response) {
    try {
      const { school_id } = req.params;
      const { term, year, class_level } = req.query;

      const filters = {
        term: term ? parseInt(term as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        class_level: class_level as string
      };

      const examSets = await examSetService.getExamSetsBySchool(parseInt(school_id), filters);
      res.status(200).json(examSets);
    } catch (error) {
      res.status(500).json({ message: 'Error getting exam sets', error });
    }
  }

  async getExamSet(req: Request, res: Response) {
    try {
      const { set_id } = req.params;
      const examSet = await examSetService.getExamSetById(parseInt(set_id));
      res.status(200).json(examSet);
    } catch (error) {
      res.status(500).json({ message: 'Error getting exam set', error });
    }
  }
}

export default new ExamSetController();

