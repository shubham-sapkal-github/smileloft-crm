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
const { listLeads, setStage, setStatus, assignOwner, addNote, createLead, scopeFor } =
  await import("./leads");
const { buildFunnel } = await import("./funnel");

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

test("the funnel an agent sees is built only from their own leads", async () => {
  await seed({ name: "LeadsCheck Mine", ownerId: AGENT.id, stage: "Won" });
  await seed({ name: "LeadsCheck AlsoMine", ownerId: AGENT.id, stage: "New" });
  await seed({ name: "LeadsCheck Theirs", stage: "Won" });
  await seed({ name: "LeadsCheck TheirsLost", stage: "Lost" });

  // The database also holds seeded demo data, so narrow to this test's own
  // fixtures. What is being proven is which of them survive listLeads.
  const mine = (list: Awaited<ReturnType<typeof listLeads>>) =>
    list.filter((lead) => lead.name.startsWith("LeadsCheck"));

  actingUser = ADMIN;
  const adminFunnel = buildFunnel(mine(await listLeads()));
  actingUser = AGENT;
  const agentFunnel = buildFunnel(mine(await listLeads()));

  // 4 leads for the admin (3 on the path, 1 lost); 2 for the agent, none lost.
  expect(adminFunnel.total).toBe(4);
  expect(adminFunnel.lost).toBe(1);
  expect(agentFunnel.total).toBe(2);
  expect(agentFunnel.lost).toBe(0);

  // Every bar the agent sees is smaller: the admin's extra Won lead is absent.
  expect(agentFunnel.steps[0].reached).toBe(2);
  expect(adminFunnel.steps[0].reached).toBe(3);
  expect(agentFunnel.steps.at(-1)!.reached).toBe(1);
  expect(adminFunnel.steps.at(-1)!.reached).toBe(2);
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

// ---- creating a lead ----

const NEW_LEAD = {
  name: "LeadsCheck Created",
  email: "created@example.com",
  phone: "07700 900200",
  location: "Manchester",
  treatmentInterest: "Invisalign",
};

const storedByName = async (name: string) => Lead.findOne({ name }).lean();

test("an agent's new lead is owned by that agent, at New and Active", async () => {
  actingUser = AGENT;

  const result = await createLead(NEW_LEAD);

  expect(result.ok).toBe(true);
  const lead = await storedByName(NEW_LEAD.name);
  expect(lead!.ownerId).toBe(AGENT.id);
  expect(lead!.stage).toBe("New");
  expect(lead!.status).toBe("Active");
});

test("an admin's new lead starts unassigned", async () => {
  actingUser = ADMIN;

  await createLead(NEW_LEAD);

  expect((await storedByName(NEW_LEAD.name))!.ownerId).toBeNull();
});

// The one that matters: if this passes while the stored document carries a
// client-supplied owner, the rest of the permission model is decoration.
test("mass assignment: ownerId, stage and status in the input are ignored", async () => {
  actingUser = AGENT;

  await createLead({
    ...NEW_LEAD,
    ownerId: ADMIN.id,
    stage: "Won",
    status: "Archived",
    _id: "6a857d0729aff31e703cd999",
  } as never);

  const lead = await storedByName(NEW_LEAD.name);
  expect(lead!.ownerId).toBe(AGENT.id);
  expect(lead!.stage).toBe("New");
  expect(lead!.status).toBe("Active");
});

test("a lead with no name is refused, keyed to name, and nothing is stored", async () => {
  const result = await createLead({ ...NEW_LEAD, name: "" });

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.errors.name).toMatch(/name/i);
  expect(await Lead.countDocuments({ email: NEW_LEAD.email })).toBe(0);
});

test("a lead with no email and no phone is refused, keyed to phone", async () => {
  const result = await createLead({ ...NEW_LEAD, email: "", phone: "" });

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.errors.phone).toMatch(/at least one of email or phone/);
  expect(await storedByName(NEW_LEAD.name)).toBeNull();
});

test("a failed create hands back what was submitted so the form can refill", async () => {
  const submitted = { ...NEW_LEAD, name: "", location: "Stockport" };

  const result = await createLead(submitted);

  if (result.ok) throw new Error("expected failure");
  expect(result.values).toEqual(submitted);
  expect(result.values.location).toBe("Stockport");
  expect(result.values.treatmentInterest).toBe(NEW_LEAD.treatmentInterest);
});

test("a field over the length cap is refused, keyed to that field", async () => {
  const result = await createLead({ ...NEW_LEAD, location: "x".repeat(201) });

  if (result.ok) throw new Error("expected failure");
  expect(result.errors.location).toMatch(/too long/i);
  expect(await storedByName(NEW_LEAD.name)).toBeNull();
});

test("stored values are trimmed", async () => {
  await createLead({ ...NEW_LEAD, name: "  LeadsCheck Created  ", location: "  Bolton  " });

  const lead = await storedByName("LeadsCheck Created");
  expect(lead!.location).toBe("Bolton");
});

test("an admin's unassigned lead is invisible to agents", async () => {
  actingUser = ADMIN;
  await createLead(NEW_LEAD);

  actingUser = AGENT;
  expect((await listLeads()).map((l) => l.name)).not.toContain(NEW_LEAD.name);
});

// ---- archiving ----

test("an agent can archive and unarchive their own lead", async () => {
  const lead = await seed({ ownerId: AGENT.id, status: "Active" });
  actingUser = AGENT;

  expect(await setStatus(String(lead._id), "Archived")).toEqual({ ok: true });
  expect((await stored(lead._id)).status).toBe("Archived");
  expect((await listLeads()).map((l) => l.name)).not.toContain(lead.name);

  expect(await setStatus(String(lead._id), "Active")).toEqual({ ok: true });
  expect((await stored(lead._id)).status).toBe("Active");
});

test("an agent cannot archive a lead they do not own", async () => {
  const lead = await seed({ status: "Active" });
  actingUser = AGENT;

  expect(await setStatus(String(lead._id), "Archived")).toEqual({
    ok: false,
    error: "Lead not found.",
  });
  expect((await stored(lead._id)).status).toBe("Active");
});

test("a status outside Active/Archived is refused and nothing is stored", async () => {
  const lead = await seed({ status: "Active" });

  expect(await setStatus(String(lead._id), "Binned" as never)).toEqual({
    ok: false,
    error: "Unknown status.",
  });
  expect((await stored(lead._id)).status).toBe("Active");
});
