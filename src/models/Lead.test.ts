import { afterAll, beforeAll, expect, test } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db";
import { Lead } from "./Lead";
import { STAGES, STATUSES, type Stage, type Status } from "./lead-enums";

beforeAll(async () => {
  await connectToDatabase();
});

afterAll(async () => {
  await Lead.deleteMany({ name: /^ModelCheck/ });
  await mongoose.disconnect();
});

test("a new lead defaults to stage New, status Active, no owner, no notes", async () => {
  const lead = await Lead.create({ name: "ModelCheck Defaults", phone: "07700 900001" });
  expect(lead.stage).toBe("New");
  expect(lead.status).toBe("Active");
  expect(lead.ownerId).toBeNull();
  expect(lead.notes).toHaveLength(0);
});

test("a stage outside the six is rejected", async () => {
  await expect(
    Lead.create({ name: "ModelCheck BadStage", phone: "07700 900002", stage: "Deleted" as Stage }),
  ).rejects.toThrow(/stage/);
});

test("a status outside Active/Archived is rejected", async () => {
  await expect(
    Lead.create({ name: "ModelCheck BadStatus", phone: "07700 900003", status: "Binned" as Status }),
  ).rejects.toThrow(/status/);
});

test("a lead with no name is rejected", async () => {
  await expect(Lead.create({ phone: "07700 900000" })).rejects.toThrow(/name/);
});

test("a lead with a name but no email and no phone is rejected", async () => {
  await expect(
    Lead.create({ name: "ModelCheck NoContact", location: "Manchester" }),
  ).rejects.toThrow(/at least one of email or phone/);
});

test("a lead with a name and a phone is accepted", async () => {
  const lead = await Lead.create({ name: "ModelCheck PhoneOnly", phone: "07700 900005" });
  expect(lead.phone).toBe("07700 900005");
  expect(lead.email).toBeUndefined();
});

test("a lead with a name and an email is accepted", async () => {
  const lead = await Lead.create({ name: "ModelCheck EmailOnly", email: "a@b.com" });
  expect(lead.email).toBe("a@b.com");
});

test("notes carry author and timestamp", async () => {
  const lead = await Lead.create({
    name: "ModelCheck Notes",
    phone: "07700 900004",
    notes: [{ body: "Called, left voicemail", authorId: "u1", authorName: "Tom Reid" }],
  });
  expect(lead.notes[0].body).toBe("Called, left voicemail");
  expect(lead.notes[0].authorName).toBe("Tom Reid");
  expect(lead.notes[0].createdAt).toBeInstanceOf(Date);
});

test("the enums are the six stages and two statuses the spec names", () => {
  expect(STAGES).toEqual([
    "New",
    "Contacted",
    "Consult Booked",
    "Treatment Planned",
    "Won",
    "Lost",
  ]);
  expect(STATUSES).toEqual(["Active", "Archived"]);
});

test("re-importing the module does not re-register the model", async () => {
  const again = await import("./Lead");
  expect(again.Lead).toBe(Lead);
});
