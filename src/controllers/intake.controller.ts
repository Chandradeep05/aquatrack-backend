import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { IntakeLog } from '../models/IntakeLog';
import { AppSettings } from '../models/AppSettings';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { getUTCDayRange } from '../utils/date';

export const logIntake = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, consumedAt } = req.body;
    const userId = req.user!._id;

    const entry = new IntakeLog({
      userId,
      amount,
      consumedAt: consumedAt ? new Date(consumedAt) : new Date()
    });

    await entry.save();

    return sendSuccess(
      res,
      {
        entry: {
          id: entry._id,
          amount: entry.amount,
          consumedAt: entry.consumedAt,
          createdAt: entry.createdAt
        }
      },
      'Water intake logged successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getTodayIntake = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;
    const { startOfDay, endOfDay, dateString } = getUTCDayRange();

    // Fetch system daily goal (with guaranteed 2000 ml fallback)
    const settings = await AppSettings.findOne().sort({ updatedAt: -1 });
    const dailyGoalMl = settings?.dailyGoalMl || 2000;

    // Fetch today's intake entries in UTC
    const entries = await IntakeLog.find({
      userId,
      consumedAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ consumedAt: -1 });

    const totalIntakeMl = entries.reduce((sum, item) => sum + item.amount, 0);
    const progressPercentage = Math.round((totalIntakeMl / dailyGoalMl) * 100);
    const remainingMl = Math.max(0, dailyGoalMl - totalIntakeMl);

    return sendSuccess(
      res,
      {
        date: dateString,
        totalIntakeMl,
        dailyGoalMl,
        progressPercentage,
        remainingMl,
        entries: entries.map((e) => ({
          id: e._id,
          amount: e.amount,
          consumedAt: e.consumedAt
        }))
      },
      'Today intake summary retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getIntakeHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;

    // Fetch system daily goal (with guaranteed 2000 ml fallback)
    const settings = await AppSettings.findOne().sort({ updatedAt: -1 });
    const dailyGoalMl = settings?.dailyGoalMl || 2000;

    // Aggregate logs grouped by UTC date
    const history = await IntakeLog.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId.toString())
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$consumedAt', timezone: 'UTC' }
          },
          totalIntakeMl: { $sum: '$amount' },
          entriesCount: { $sum: 1 },
          entries: {
            $push: {
              id: '$_id',
              amount: '$amount',
              consumedAt: '$consumedAt'
            }
          }
        }
      },
      {
        $sort: { _id: -1 }
      }
    ]);

    const formattedHistory = history.map((day) => ({
      date: day._id,
      totalIntakeMl: day.totalIntakeMl,
      dailyGoalMl,
      percentage: Math.round((day.totalIntakeMl / dailyGoalMl) * 100),
      isGoalAchieved: day.totalIntakeMl >= dailyGoalMl,
      status: day.totalIntakeMl >= dailyGoalMl ? 'Goal achieved' : 'Below goal',
      entriesCount: day.entriesCount,
      entries: day.entries
    }));

    return sendSuccess(
      res,
      {
        dailyGoalMl,
        history: formattedHistory
      },
      'Intake history retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const deleteIntake = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Resource not found with the specified identifier', 404);
    }

    const entry = await IntakeLog.findById(id);
    if (!entry) {
      return sendError(res, 'Intake log entry not found', 404);
    }

    // Ownership check: entry must belong to the requester
    if (entry.userId.toString() !== req.user!._id.toString()) {
      return sendError(res, 'You are not authorized to perform this action.', 403);
    }

    await IntakeLog.findByIdAndDelete(id);

    return sendSuccess(res, null, 'Intake entry deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};
