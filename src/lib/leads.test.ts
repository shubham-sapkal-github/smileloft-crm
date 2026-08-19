import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import mongoose from "mongoose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

const { USERS } = await import("./users");
const ADMIN = USERS.find((u) => u.role === "admin")!;
const AGENT = USERS.find((u) => u.role === "agent")!;
const OTHER_AGENT_ID = "u_someone_else";

// getCurrentUser is the single seam for identity, so the tests drive it.
let actingUser = ADMIN;
vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return { ...actual, getCurrentUser: async () => actingUser };
});

const { connectToDatabase } = await import("./db");
const { Lead } = await import("@/models/Lead");
const { listLeads, setStage, assignOwner, addNote, scopeFor } = await import("./leads");

/** Reads the raw stored record — never trust what the action claims. */
async function stored(id: mongoose.Types.ObjectId) {
  const doc = await Lead.findById(id).lean();
  if (!doc) throw new Error("fixture vanished");
  return doc;
}

const seed = (over: Record<string, unknown> = {}) =>
  Lead.create({
    name: "LeadsCheck Fixture",
    phone: "07700 900100",
    ownerId: OTHER_AGENT_ID,
    ...over,
  });

beforeAll(async () => {
  await connectToDatabase();
});

beforeEach(async () => {
  await Lead.deleteMany({ name: /^LeadsCheck/ });
  actingUser = ADMIN;
});

afterAll(async () => {
  await Lead.deleteMany({ name: /^LeadsCheck/ });
  await mongoose.disconnect();
});

test("scopeFor is unrestricted for an admin and ownership-bound for an agent", () => {
  expect(scopeFor(ADMIN)).toEqual({});
  expect(scopeFor(AGENT)).toEqual({ ownerId: AGENT.id });
});

test("an agent lists only their own leads", async () => {
  await seed({ name: "LeadsCheck Mine", ownerId: AGENT.id });
  await seed({ name: "LeadsCheck Theirs" });

  actingUser = AGENT;
  const names = (await listLeads()).map((l) => l.name);

  expect(names).toContain("LeadsCheck Mine");
  expect(names).not.toContain("LeadsCheck Theirs");
});

test("an admin lists every lead", async () => {
  await seed({ name: "LeadsCheck Mine", ownerId: AGENT.id });
  await seed({ name: "LeadsCheck Theirs" });

  const names = (await listLeads()).map((l) => l.name);

  expect(names).toEqual(
    expect.arrayContaining(["LeadsCheck Mine", "LeadsCheck Theirs"]),
  );
});

test("archived leads are hidden by default and shown on request", async () => {
  await seed({ name: "LeadsCheck Archived", status: "Archived" });

  expect((await listLeads()).map((l) => l.name)).not.toContain("LeadsCheck Archived");
  expect((await listLeads({ includeArchived: true })).map((l) => l.name)).toContain(
    "LeadsCheck Archived",
  );
});

// ---- the block, proven against the stored record ----

test("setStage: an agent cannot move a lead they do not own", async () => {
  const lead = await seed({ stage: "New" });
  actingUser = AGENT;

  const result = await setStage(String(lead._id), "Won");

  expect(result).toEqual({ ok: false, error: "Lead not found." });
  expect((await stored(lead._id)).stage).toBe("New");
});

test("assignOwner: an agent cannot reassign even their own lead", async () => {
  const lead = await seed({ ownerId: AGENT.id });
  actingUser = AGENT;

  const result = await assignOwner(String(lead._id), ADMIN.id);

  expect(result).toEqual({ ok: false, error: "Lead not found." });
  expect((await stored(lead._id)).ownerId).toBe(AGENT.id);
});

test("addNote: an agent cannot note a lead they do not own", async () => {
  const lead = await seed();
  actingUser = AGENT;

  const result = await addNote(String(lead._id), "sneaking this in");

  expect(result).toEqual({ ok: false, error: "Lead not found." });
  expect((await stored(lead._id)).notes).toHaveLength(0);
});

test("a refused agent gets the same answer for valid, invalid and empty payloads", async () => {
  const lead = await seed({ stage: "New" });
  actingUser = AGENT;
  const id = String(lead._id);

  const valid = await setStage(id, "Won");
  const invalid = await setStage(id, "Deleted" as never);
  const empty = await addNote(id, "");

  expect(valid).toEqual({ ok: false, error: "Lead not found." });
  expect(invalid).toEqual({ ok: false, error: "Lead not found." });
  expect(empty).toEqual({ ok: false, error: "Lead not found." });

  const after = await stored(lead._id);
  expect(after.stage).toBe("New");
  expect(after.notes).toHaveLength(0);
});

// ---- the allowed paths, also proven against the stored record ----

test("setStage: an agent can move their own lead", async () => {
  const lead = await seed({ ownerId: AGENT.id, stage: "New" });
  actingUser = AGENT;

  expect(await setStage(String(lead._id), "Contacted")).toEqual({ ok: true });
  expect((await stored(lead._id)).stage).toBe("Contacted");
});

test("setStage: an admin can move anyone's lead", async () => {
  const lead = await seed({ stage: "New" });

  expect(await setStage(String(lead._id), "Won")).toEqual({ ok: true });
  expect((await stored(lead._id)).stage).toBe("Won");
});

test("assignOwner: an admin can reassign", async () => {
  const lead = await seed({ ownerId: AGENT.id });

  expect(await assignOwner(String(lead._id), ADMIN.id)).toEqual({ ok: true });
  expect((await stored(lead._id)).ownerId).toBe(ADMIN.id);
});

test("addNote: an agent can note their own lead, with authorship", async () => {
  const lead = await seed({ ownerId: AGENT.id });
  actingUser = AGENT;

  expect(await addNote(String(lead._id), "  Called, left voicemail  ")).toEqual({
    ok: true,
  });

  const notes = (await stored(lead._id)).notes;
  expect(notes).toHaveLength(1);
  expect(notes[0].body).toBe("Called, left voicemail");
  expect(notes[0].authorId).toBe(AGENT.id);
});

// ---- payload validation, for callers who are allowed through ----

test("a stage outside the six is refused and nothing is stored", async () => {
  const lead = await seed({ stage: "New" });

  expect(await setStage(String(lead._id), "Deleted" as never)).toEqual({
    ok: false,
    error: "Unknown stage.",
  });
  expect((await stored(lead._id)).stage).toBe("New");
});

test("an owner who is not one of ours is refused", async () => {
  const lead = await seed();

  expect(await assignOwner(String(lead._id), "u_injected")).toEqual({
    ok: false,
    error: "Unknown owner.",
  });
  expect((await stored(lead._id)).ownerId).toBe(OTHER_AGENT_ID);
});

test("an empty note is refused and nothing is stored", async () => {
  const lead = await seed();

  expect(await addNote(String(lead._id), "   ")).toEqual({
    ok: false,
    error: "A note cannot be empty.",
  });
  expect((await stored(lead._id)).notes).toHaveLength(0);
});

test("a malformed lead id is refused like a missing one", async () => {
  expect(await setStage("not-an-object-id", "Won")).toEqual({
    ok: false,
    error: "Lead not found.",
  });
});
