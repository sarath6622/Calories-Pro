import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ExerciseEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    caloriesBurned: { type: Number, required: true, min: 0 },
    note: { type: String, default: null },
    loggedAt: { type: Date, default: () => new Date() },
    // Phase 8 / F-PWA-5: true when the entry was first written to the offline
    // IndexedDB queue and replayed via /api/sync/replay. Adopted across all five
    // log models (PRD §4.3 originally defined this on FoodLogEntry only; option A
    // of the Phase 8 schema decision adds it consistently so debugging and
    // analytics know which entries originated offline).
    syncedFromOffline: { type: Boolean, default: false },
    // Phase 8: see FoodLogEntry.ts — sparse-unique `clientId` makes replay
    // race-safe via E11000 instead of an app-level dedup check.
    clientId: { type: String, default: null },
  },
  { timestamps: false },
);

ExerciseEntrySchema.index({ userId: 1, date: 1 });
ExerciseEntrySchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

ExerciseEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type ExerciseEntryDocument = InferSchemaType<typeof ExerciseEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ExerciseEntry: Model<ExerciseEntryDocument> =
  (mongoose.models.ExerciseEntry as Model<ExerciseEntryDocument> | undefined) ??
  mongoose.model<ExerciseEntryDocument>("ExerciseEntry", ExerciseEntrySchema);
