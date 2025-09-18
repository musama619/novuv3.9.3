import mongoose, { Schema } from 'mongoose';

import { schemaOptions } from '../schema-default.options';
import { UserDBModel } from './user.entity';

const userSchema = new Schema<UserDBModel>(
  {
    firstName: Schema.Types.String,
    lastName: Schema.Types.String,
    email: Schema.Types.String,
    profilePicture: Schema.Types.String,
    resetToken: Schema.Types.String,
    resetTokenDate: Schema.Types.Date,
    resetTokenCount: {
      reqInMinute: Schema.Types.Number,
      reqInDay: Schema.Types.Number,
    },
    showOnBoarding: Schema.Types.Boolean,
    showOnBoardingTour: Schema.Types.Number,
    tokens: [
      {
        providerId: Schema.Types.String,
        provider: Schema.Types.String,
        accessToken: Schema.Types.String,
        refreshToken: Schema.Types.String,
        valid: Schema.Types.Boolean,
        lastUsed: Schema.Types.Date,
        username: Schema.Types.String,
      },
    ],
    password: Schema.Types.String,
    failedLogin: {
      times: Schema.Types.Number,
      lastFailedAttempt: Schema.Types.Date,
    },
    servicesHashes: {
      intercom: Schema.Types.String,
      plain: Schema.Types.String,
    },
    jobTitle: Schema.Types.String,
    externalId: Schema.Types.String,
  },
  schemaOptions
);

// Create a unique index for email field only when self-hosted
if (process.env.SELF_HOSTED === 'true') {
  userSchema.index(
    { email: 1 },
    {
      unique: true,
    }
  );
}

export const User =
  (mongoose.models.User as mongoose.Model<UserDBModel>) || mongoose.model<UserDBModel>('User', userSchema);
