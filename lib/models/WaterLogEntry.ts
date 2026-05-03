import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const WaterLogEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    amountMl: { type: Number, required: true, min: 1 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

WaterLogEntrySchema.index({ userId: 1, date: 1 });

WaterLogEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type WaterLogEntryDocument = InferSchemaType<typeof WaterLogEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WaterLogEntry: Model<WaterLogEntryDocument> =
  (mongoose.models.WaterLogEntry as Model<WaterLogEntryDocument> | undefined) ??
  mongoose.model<WaterLogEntryDocument>("WaterLogEntry", WaterLogEntrySchema);
