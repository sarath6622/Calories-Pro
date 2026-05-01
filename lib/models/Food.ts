import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SERVING_UNITS } from "./food-enums";

export { SERVING_UNITS } from "./food-enums";
export type { ServingUnit, FoodFilter, FOOD_FILTERS } from "./food-enums";

const MacrosSchema = new Schema(
  {
    proteinG: { type: Number, required: true, min: 0 },
    carbsG: { type: Number, required: true, min: 0 },
    fatG: { type: Number, required: true, min: 0 },
    fiberG: { type: Number, default: null },
    sugarG: { type: Number, default: null },
  },
  { _id: false },
);

const FoodSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: null, trim: true },
    servingSize: { type: Number, required: true, min: 0.0001 },
    servingUnit: { type: String, enum: SERVING_UNITS, required: true },
    caloriesPerServing: { type: Number, required: true, min: 0 },
    macrosPerServing: { type: MacrosSchema, required: true },
    isFavorite: { type: Boolean, default: false },
    timesLogged: { type: Number, default: 0, min: 0 },
    lastLoggedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

FoodSchema.index({ userId: 1, name: 1 });
FoodSchema.index({ userId: 1, lastLoggedAt: -1, timesLogged: -1 });
FoodSchema.index({ userId: 1, isFavorite: 1 });

FoodSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type FoodDocument = InferSchemaType<typeof FoodSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const Food: Model<FoodDocument> =
  (mongoose.models.Food as Model<FoodDocument> | undefined) ??
  mongoose.model<FoodDocument>("Food", FoodSchema);
