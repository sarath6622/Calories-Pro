import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MEAL_TYPES } from "@/lib/log/meal-type";

const SnapshotMacrosSchema = new Schema(
  {
    proteinG: { type: Number, required: true, min: 0 },
    carbsG: { type: Number, required: true, min: 0 },
    fatG: { type: Number, required: true, min: 0 },
    fiberG: { type: Number, default: null },
    sugarG: { type: Number, default: null },
  },
  { _id: false },
);

const SnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    caloriesPerServing: { type: Number, required: true, min: 0 },
    macrosPerServing: { type: SnapshotMacrosSchema, required: true },
  },
  { _id: false },
);

const FoodLogEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    foodId: { type: Schema.Types.ObjectId, ref: "Food", required: true, index: true },
    date: { type: Date, required: true },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    servings: { type: Number, required: true, min: 0.0001 },
    snapshot: { type: SnapshotSchema, required: true },
    loggedAt: { type: Date, default: () => new Date() },
    syncedFromOffline: { type: Boolean, default: false },
    // Phase 8 / F-PWA-5: client-generated UUID stamped onto entries that
    // originated in the offline IndexedDB queue. The sparse-unique index on
    // (userId, clientId) makes the /api/sync/replay endpoint race-safe — if a
    // network glitch causes the same UUID to be replayed twice, the second
    // insert hits E11000 and the endpoint returns `duplicate` instead of
    // double-creating. Live (online) writes leave this `null` and skip the
    // partial index entirely.
    clientId: { type: String, default: null },
  },
  { timestamps: false },
);

FoodLogEntrySchema.index({ userId: 1, date: 1 });
FoodLogEntrySchema.index({ userId: 1, date: 1, mealType: 1 });
FoodLogEntrySchema.index({ userId: 1, foodId: 1 });
FoodLogEntrySchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } },
);

FoodLogEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type FoodLogEntryDocument = InferSchemaType<typeof FoodLogEntrySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const FoodLogEntry: Model<FoodLogEntryDocument> =
  (mongoose.models.FoodLogEntry as Model<FoodLogEntryDocument> | undefined) ??
  mongoose.model<FoodLogEntryDocument>("FoodLogEntry", FoodLogEntrySchema);
