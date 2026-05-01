import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ACTIVITY_LEVELS,
  HEIGHT_UNITS,
  ROLES,
  SEX_VALUES,
  WATER_UNITS,
  WEIGHT_UNITS,
} from "./user-enums";

export {
  ACTIVITY_LEVELS,
  HEIGHT_UNITS,
  ROLES,
  SEX_VALUES,
  WATER_UNITS,
  WEIGHT_UNITS,
} from "./user-enums";
export type { ActivityLevel, HeightUnit, Role, Sex, WaterUnit, WeightUnit } from "./user-enums";

const MealReminderSchema = new Schema(
  {
    mealType: { type: String, required: true },
    time: { type: String, required: true },
  },
  { _id: false },
);

const ProfileSchema = new Schema(
  {
    dateOfBirth: { type: Date, default: null },
    sex: { type: String, enum: SEX_VALUES, default: "other" },
    heightCm: { type: Number, default: null },
    activityLevel: { type: String, enum: ACTIVITY_LEVELS, default: "sedentary" },
    timezone: { type: String, default: "UTC" },
    units: {
      weight: { type: String, enum: WEIGHT_UNITS, default: "kg" },
      height: { type: String, enum: HEIGHT_UNITS, default: "cm" },
      water: { type: String, enum: WATER_UNITS, default: "ml" },
    },
  },
  { _id: false },
);

const GoalsSchema = new Schema(
  {
    dailyCalories: { type: Number, default: 0 },
    dailyProteinG: { type: Number, default: 0 },
    dailyCarbsG: { type: Number, default: 0 },
    dailyFatG: { type: Number, default: 0 },
    dailyWaterMl: { type: Number, default: 0 },
    targetWeightKg: { type: Number, default: null },
    sleepHoursTarget: { type: Number, default: 8 },
  },
  { _id: false },
);

const RemindersSchema = new Schema(
  {
    waterIntervalMinutes: { type: Number, default: 0 },
    mealReminders: { type: [MealReminderSchema], default: [] },
    sleepReminderTime: { type: String, default: null },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, default: "user", index: true },
    profile: { type: ProfileSchema, default: () => ({}) },
    goals: { type: GoalsSchema, default: () => ({}) },
    reminders: { type: RemindersSchema, default: () => ({}) },
  },
  { timestamps: true },
);

UserSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (mongoose.models.User as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", UserSchema);
