import { Request, Response, NextFunction } from 'express';
import { AppSettings } from '../models/AppSettings';
import { sendSuccess } from '../utils/apiResponse';

export const getDailyGoal = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await AppSettings.findOne({ key: 'global' });
    const dailyGoalMl = settings?.dailyGoalMl || 2000;

    return sendSuccess(
      res,
      {
        dailyGoalMl,
        updatedAt: settings?.updatedAt || null
      },
      'Daily goal retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const updateDailyGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dailyGoalMl } = req.body;
    const userId = req.user!._id;

    const settings = await AppSettings.findOneAndUpdate(
      { key: 'global' },
      {
        key: 'global',
        dailyGoalMl,
        updatedBy: userId,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(
      res,
      {
        dailyGoalMl: settings.dailyGoalMl,
        updatedAt: settings.updatedAt
      },
      'Daily goal updated successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};
