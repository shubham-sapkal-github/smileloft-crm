import { afterEach, expect, test } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase } from "./db";

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

afterEach(async () => {
  await mongoose.disconnect();
  globalForMongoose.mongooseConnection = undefined;
});

test("throws a named error when MONGODB_URI is unset", () => {
  const saved = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI;
  expect(() => connectToDatabase()).toThrow(/MONGODB_URI/);
  process.env.MONGODB_URI = saved;
});

test("reuses one connection across calls", async () => {
  const first = await connectToDatabase();
  const second = await connectToDatabase();
  expect(second).toBe(first);
  expect(mongoose.connections.filter((c) => c.readyState === 1)).toHaveLength(1);
});

test("a failed connect is not cached, so a later call can retry", async () => {
  const saved = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/nope?serverSelectionTimeoutMS=300";
  await expect(connectToDatabase()).rejects.toThrow();
  expect(globalForMongoose.mongooseConnection).toBeUndefined();

  process.env.MONGODB_URI = saved;
  await expect(connectToDatabase()).resolves.toBeDefined();
});
