import mongoose from 'mongoose';

// Fail fast at startup instead of buffering queries until a request times out.
const SERVER_SELECTION_TIMEOUT_MS = 5000;

export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
