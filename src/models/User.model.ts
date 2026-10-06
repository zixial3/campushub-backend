import { Schema, model } from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
}

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true },
);

export const UserModel = model<IUser>('User', userSchema);
