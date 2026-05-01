import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PasswordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDocument = InferSchemaType<typeof PasswordResetTokenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PasswordResetToken: Model<PasswordResetTokenDocument> =
  (mongoose.models.PasswordResetToken as Model<PasswordResetTokenDocument> | undefined) ??
  mongoose.model<PasswordResetTokenDocument>("PasswordResetToken", PasswordResetTokenSchema);
