import mongoose from "mongoose";

// Next's dev server re-evaluates modules on every save. Without a cache that
// survives re-evaluation, each save opens another connection until Mongo runs
// out. globalThis is the one thing hot reload does not throw away.
const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

export function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local (see docs/STACK.md).",
    );
  }

  // A failed connect must not be cached, or one restart of the Mongo container
  // poisons every later request until the dev server itself is restarted.
  globalForMongoose.mongooseConnection ??= mongoose.connect(uri).catch((err) => {
    globalForMongoose.mongooseConnection = undefined;
    throw err;
  });

  return globalForMongoose.mongooseConnection;
}
