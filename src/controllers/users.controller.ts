import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { IntakeLog } from '../models/IntakeLog';
import { AppSettings } from '../models/AppSettings';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { getUTCDayRange } from '../utils/date';

export const getAllUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });

    // Single aggregation query to count intake logs for all users in one round-trip (O(1) database call)
    const logCounts = await IntakeLog.aggregate([
      {
        $group: {
          _id: '$userId',
          totalLogs: { $sum: 1 }
        }
      }
    ]);

    const logCountMap = new Map<string, number>();
    for (const item of logCounts) {
      logCountMap.set(item._id.toString(), item.totalLogs);
    }

    const userStats = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      totalIntakeLogs: logCountMap.get(user._id.toString()) || 0
    }));

    const totalUsersCount = users.length;
    const totalIntakeLogsCount = await IntakeLog.countDocuments();

    // Aggregated sum for today's intake directly in DB
    const { startOfDay, endOfDay } = getUTCDayRange();
    const todaySumResult = await IntakeLog.aggregate([
      {
        $match: {
          consumedAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    const todayTotalIntakeMl = todaySumResult.length > 0 ? todaySumResult[0].total : 0;

    const settings = await AppSettings.findOne({ key: 'global' });
    const currentDailyGoalMl = settings?.dailyGoalMl || 2000;

    return sendSuccess(
      res,
      {
        metrics: {
          totalUsers: totalUsersCount,
          totalIntakeLogs: totalIntakeLogsCount,
          todayTotalIntakeMl,
          currentDailyGoalMl
        },
        users: userStats
      },
      'Users retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getUserIntakeHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Resource not found with the specified identifier', 404);
    }

    const targetUser = await User.findById(id).select('-passwordHash');
    if (!targetUser) {
      return sendError(res, 'User not found', 404);
    }

    const settings = await AppSettings.findOne({ key: 'global' });
    const dailyGoalMl = settings?.dailyGoalMl || 2000;

    const history = await IntakeLog.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(id)
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
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        },
        dailyGoalMl,
        history: formattedHistory
      },
      'User intake history retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Resource not found with the specified identifier', 404);
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendError(res, 'User not found', 404);
    }

    if (req.user!._id.toString() === id) {
      return sendError(res, 'Admins cannot delete their own account.', 400);
    }

    let cascadeDeletedLogsCount = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const deletedLogs = await IntakeLog.deleteMany({ userId: targetUser._id }).session(session);
        cascadeDeletedLogsCount = deletedLogs.deletedCount;
        await User.findByIdAndDelete(targetUser._id).session(session);
      });
    } catch (transactionError: any) {
      // Standalone MongoDB instances do not support replica set transactions; fallback gracefully
      if (
        transactionError?.message?.includes('replica set') ||
        transactionError?.code === 20 ||
        transactionError?.codeName === 'IllegalOperation'
      ) {
        const deletedLogs = await IntakeLog.deleteMany({ userId: targetUser._id });
        cascadeDeletedLogsCount = deletedLogs.deletedCount;
        await User.findByIdAndDelete(targetUser._id);
      } else {
        throw transactionError;
      }
    } finally {
      await session.endSession();
    }

    return sendSuccess(
      res,
      {
        deletedUserId: id,
        cascadeDeletedLogsCount
      },
      'User and associated intake records deleted successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};
