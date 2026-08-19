import "server-only";
import mongoose, { type QueryFilter } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "./db";
import { getCurrentUser } from "./auth";
import { USERS, type User } from "./users";
import { Lead, type LeadDoc } from "@/models/Lead";
import { STAGES, STATUSES, type Stage, type Status } from "@/models/lead-enums";

// A refusal and a missing record are indistinguishable on purpose: the table
// must not be usable to discover which lead ids exist.
const DENIED = { ok: false, error: "Lead not found." } as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

/** The only fields a caller may supply. Everything else is set by the server. */
export type NewLeadInput = {
  name: string;
  email: string;
  phone: string;
  location: string;
  treatmentInterest: string;
};

export type CreateResult =
  | { ok: true; id: string; name: string }
  | {
      ok: false;
      errors: Partial<Record<keyof NewLeadInput, string>>;
      // Handed back so the form can be refilled: React clears an uncontrolled
      // form once the action resolves, and five retyped fields is a real loss.
      values: NewLeadInput;
    };

export type LeadNote = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type LeadListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  treatmentInterest: string | null;
  stage: Stage;
  /** Where a Lost lead had got to, so the funnel can still credit it. */
  lostFromStage: Stage | null;
  status: Status;
  ownerId: string | null;
  ownerName: string | null;
  notes: LeadNote[];
};

/**
 * The whole access rule, in one place, expressed as what the user owns rather
 * than as a list of things they may not do. Merged into every query and every
 * mutation filter, so an agent acting on someone else's lead matches zero
 * documents rather than relying on a branch somebody has to remember to write.
 */
export function scopeFor(user: User): QueryFilter<LeadDoc> {
  return user.role === "admin" ? {} : { ownerId: user.id };
}

const ownerNameFor = (ownerId: string | null) =>
  USERS.find((user) => user.id === ownerId)?.name ?? null;

function toListItem(lead: LeadDoc & { _id: mongoose.Types.ObjectId }): LeadListItem {
  return {
    id: String(lead._id),
    name: lead.name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    location: lead.location ?? null,
    treatmentInterest: lead.treatmentInterest ?? null,
    stage: lead.stage as Stage,
    lostFromStage: (lead.lostFromStage as Stage | null) ?? null,
    status: lead.status as Status,
    ownerId: lead.ownerId ?? null,
    ownerName: ownerNameFor(lead.ownerId ?? null),
    notes: (lead.notes ?? []).map((note) => ({
      id: String((note as { _id: mongoose.Types.ObjectId })._id),
      body: note.body,
      authorName: note.authorName,
      createdAt: new Date(note.createdAt).toISOString(),
    })),
  };
}

export async function listLeads(
  { includeArchived = false } = {},
): Promise<LeadListItem[]> {
  await connectToDatabase();
  const user = await getCurrentUser();

  const filter: QueryFilter<LeadDoc> = {
    ...scopeFor(user),
    ...(includeArchived ? {} : { status: "Active" }),
  };

  const leads = await Lead.find(filter).sort({ updatedAt: -1 }).lean();
  return leads.map(toListItem);
}

/**
 * Permission first: locate the lead *within the caller's scope* before looking
 * at anything else the caller sent. An agent aiming at a lead they do not own
 * is refused identically whether their payload is valid, invalid or empty.
 */
async function findInScope(leadId: string, user: User) {
  if (!mongoose.isValidObjectId(leadId)) return null;
  return Lead.findOne({ _id: leadId, ...scopeFor(user) });
}

export async function setStage(leadId: string, stage: Stage): Promise<ActionResult> {
  await connectToDatabase();
  const user = await getCurrentUser();

  const lead = await findInScope(leadId, user);
  if (!lead) return DENIED;

  if (!STAGES.includes(stage)) return { ok: false, error: "Unknown stage." };

  // Remember the stage a lead is lost from, and forget it if the lead comes
  // back onto the pipeline. Without this the funnel cannot tell where people
  // fall out, and losing a lead silently flatters the conversion of the stage
  // it was lost from.
  const lostFromStage =
    stage === "Lost" ? (lead.stage === "Lost" ? lead.lostFromStage : lead.stage) : null;

  // Scope stays in the write filter too: the read above could go stale, and a
  // future edit that drops the pre-check must not silently open a hole.
  await Lead.updateOne(
    { _id: lead._id, ...scopeFor(user) },
    { $set: { stage, lostFromStage } },
  );
  revalidatePath("/leads");
  return { ok: true };
}

export async function assignOwner(
  leadId: string,
  ownerId: string,
): Promise<ActionResult> {
  await connectToDatabase();
  const user = await getCurrentUser();

  // Ownership decides which leads you may touch; this decides who may hand a
  // patient to someone else at all. An agent is refused even on their own lead.
  if (user.role !== "admin") return DENIED;

  const lead = await findInScope(leadId, user);
  if (!lead) return DENIED;

  if (!USERS.some((candidate) => candidate.id === ownerId)) {
    return { ok: false, error: "Unknown owner." };
  }

  await Lead.updateOne({ _id: lead._id, ...scopeFor(user) }, { $set: { ownerId } });
  revalidatePath("/leads");
  return { ok: true };
}

const NOTE_MAX_LENGTH = 2000;

export async function addNote(leadId: string, body: string): Promise<ActionResult> {
  await connectToDatabase();
  const user = await getCurrentUser();

  const lead = await findInScope(leadId, user);
  if (!lead) return DENIED;

  const trimmed = (body ?? "").trim();
  if (!trimmed) return { ok: false, error: "A note cannot be empty." };
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return { ok: false, error: `A note cannot be longer than ${NOTE_MAX_LENGTH} characters.` };
  }

  await Lead.updateOne(
    { _id: lead._id, ...scopeFor(user) },
    {
      $push: {
        notes: { body: trimmed, authorId: user.id, authorName: user.name },
      },
    },
  );
  revalidatePath("/leads");
  return { ok: true };
}

/**
 * Creating a lead has no existing owner to check against, so the guarantee is
 * a different one: **owner, stage and status come from the server's view of the
 * caller and are never read from the input.** An agent passing
 * `ownerId: "u_admin"` still gets a lead owned by themselves.
 *
 * The five fields are read out by name — an allow-list. A deny-list of fields
 * to strip would only ever be as complete as the last person to update it, and
 * adding a sensitive field to the schema would silently open a hole.
 *
 * Every user may create; reception, agents and admins all record enquiries.
 */
export async function createLead(input: NewLeadInput): Promise<CreateResult> {
  await connectToDatabase();
  const user = await getCurrentUser();

  const values: NewLeadInput = {
    name: input.name ?? "",
    email: input.email ?? "",
    phone: input.phone ?? "",
    location: input.location ?? "",
    treatmentInterest: input.treatmentInterest ?? "",
  };

  try {
    const lead = await Lead.create({
      ...values,
      // Server-derived, never from the caller. An admin records an enquiry for
      // somebody else to pick up, so theirs starts unassigned.
      ownerId: user.role === "admin" ? null : user.id,
      stage: "New",
      status: "Active",
    });
    revalidatePath("/leads");
    return { ok: true, id: String(lead._id), name: lead.name };
  } catch (error) {
    // The rule lives once, in the schema. Translate it rather than restating
    // it here, or the copy in this function is the one that goes stale.
    if (error instanceof mongoose.Error.ValidationError) {
      const errors: Partial<Record<keyof NewLeadInput, string>> = {};
      for (const [path, detail] of Object.entries(error.errors)) {
        if (path in values) errors[path as keyof NewLeadInput] = detail.message;
      }
      return { ok: false, errors, values };
    }
    throw error;
  }
}

/**
 * Archive and unarchive. Deliberately the same shape and the same rule as
 * setStage — a fourth row action inventing its own permission concept would be
 * a fourth thing to get wrong.
 */
export async function setStatus(leadId: string, status: Status): Promise<ActionResult> {
  await connectToDatabase();
  const user = await getCurrentUser();

  const lead = await findInScope(leadId, user);
  if (!lead) return DENIED;

  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

  await Lead.updateOne({ _id: lead._id, ...scopeFor(user) }, { $set: { status } });
  revalidatePath("/leads");
  return { ok: true };
}
