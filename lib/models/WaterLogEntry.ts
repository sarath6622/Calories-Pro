import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const WaterLogEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    amountMl: { type: Number, required: true, min: 1 },
    loggedAt: { type: Date, default: () => new Date() },
    // Phase 8 / F-PWA-5: see ExerciseEntry.ts for the rationale; option A adds
    // this flag to all five log models for parity with FoodLogEntry.
    syncedFromOffline: { type: Boolean, default: false },
    // Phase 8: see FoodLogEntry.ts.
    clientId: { type: String, default: null },
  },
  { timestamps: false },
);

WaterLogEntrySchema.index({ userId: 1, date: 1 });
WaterLogEntrySchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

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
