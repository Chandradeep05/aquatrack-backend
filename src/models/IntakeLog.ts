import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IIntakeLog extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  consumedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const intakeLogSchema = new Schema<IIntakeLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    amount: {
      type: Number,
      required: [true, 'Water intake amount is required'],
      min: [1, 'Water intake amount must be greater than 0.'],
      max: [10000, 'Water intake amount cannot exceed 10,000 ml per entry.']
    },
    consumedAt: {
      type: Date,
      default: Date.now,
      required: true
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

intakeLogSchema.index({ userId: 1, consumedAt: -1 });

export const IntakeLog: Model<IIntakeLog> = mongoose.model<IIntakeLog>(
  'IntakeLog',
  intakeLogSchema
);
