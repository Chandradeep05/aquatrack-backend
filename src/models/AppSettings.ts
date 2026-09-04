import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAppSettings extends Document {
  key: string;
  dailyGoalMl: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appSettingsSchema = new Schema<IAppSettings>(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
      required: true
    },
    dailyGoalMl: {
      type: Number,
      required: true,
      default: 2000,
      min: [100, 'Daily goal must be at least 100 ml.'],
      max: [20000, 'Daily goal cannot exceed 20,000 ml.']
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const obj: Record<string, any> = { ...ret };
        obj.id = obj._id;
        delete obj._id;
        delete obj.__v;
        return obj;
      }
    }
  }
);

export const AppSettings: Model<IAppSettings> = mongoose.model<IAppSettings>(
  'AppSettings',
  appSettingsSchema
);
