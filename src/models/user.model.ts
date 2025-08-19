import mongoose, { Schema, model, Document, Model, models } from 'mongoose';

export interface IUser extends Document {
    spotifyId: string;
    displayName: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
    lastLogin: Date;
}

const userSchema = new Schema<IUser>({
    spotifyId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    lastLogin: { type: Date, default: Date.now },
});

const User: Model<IUser> = models.User || model<IUser>('User', userSchema);

export default User;