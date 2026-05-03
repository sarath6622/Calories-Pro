import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const MeasurementsCmSchema = new Schema(
  {
    chest: { type: Number, default: null },
    waist: { type: Number, default: null },
    hips: { type: Number, default: null },
    leftBicep: { type: Number, default: null },
    rightBicep: { type: Number, default: null },
    leftThigh: { type: Number, default: null },
    rightThigh: { type: Number, default: null },
    leftCalf: { type: Number, default: null },
    rightCalf: { type: Number, default: null },
    neck: { type: Number, default: null },
    shoulders: { type: Number, default: null },
  },
  { _id: false },
);

const BodyMeasurementEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // PRD §4.7: user's local calendar date, stored as midnight UTC.
    date: { type: Date, required: true },
    weightKg: { type: Number, default: null },
    bodyFatPercent: { type: Number, default: null },
    measurementsCm: { type: MeasurementsCmSchema, default: () => ({}) },
    note: { type: String, default: null },
    // Reserved for a future photo upload feature; stays empty in v1 (DELIVERY_PLAN.md Phase 6).
    photos: { type: [String], default: [] },
  },
  { timestamps: true },
);

BodyMeasurementEntrySchema.index({ userId: 1, date: -1 });

BodyMeasurementEntrySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type BodyMeasurementEntryDocument = InferSchemaType<typeof BodyMeasurementEntrySchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const BodyMeasurementEntry: Model<BodyMeasurementEntryDocument> =
  (mongoose.models.BodyMeasurementEntry as Model<BodyMeasurementEntryDocument> | undefined) ??
  mongoose.model<BodyMeasurementEntryDocument>(
    "BodyMeasurementEntry",
    BodyMeasurementEntrySchema,
  );
