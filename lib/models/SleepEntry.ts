import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SleepEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // PRD §4.6: the date the sleep ENDED (wake date), midnight UTC.
    date: { type: Date, required: true },
    bedtime: { type: Date, required: true },
    wakeTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    quality: { type: Number, required: true, min: 1, max: 5 },
    note: { type: String, default: null },
  },
  { timestamps: false },
);

SleepEntrySchema.index({ userId: 1, date: 1 });

SleepEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type SleepEntryDocument = InferSchemaType<typeof SleepEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SleepEntry: Model<SleepEntryDocument> =
  (mongoose.models.SleepEntry as Model<SleepEntryDocument> | undefined) ??
  mongoose.model<SleepEntryDocument>("SleepEntry", SleepEntrySchema);
