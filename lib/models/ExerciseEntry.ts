import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ExerciseEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    caloriesBurned: { type: Number, required: true, min: 0 },
    note: { type: String, default: null },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

ExerciseEntrySchema.index({ userId: 1, date: 1 });

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
