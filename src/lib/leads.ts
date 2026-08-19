import "server-only";
import mongoose, { type QueryFilter } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "./db";
import { getCurrentUser, USERS, type User } from "./auth";
import { Lead, type LeadDoc } from "@/models/Lead";
import { STAGES, type Stage, type Status } from "@/models/lead-enums";

// A refusal and a missing record are indistinguishable on purpose: the table
// must not be usable to discover which lead ids exist.
const DENIED = { ok: false, error: "Lead not found." } as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  "use server";
  await connectToDatabase();
  const user = await getCurrentUser();

  const lead = await findInScope(leadId, user);
  if (!lead) return DENIED;

  if (!STAGES.includes(stage)) return { ok: false, error: "Unknown stage." };

  // Scope stays in the write filter too: the read above could go stale, and a
  // future edit that drops the pre-check must not silently open a hole.
  await Lead.updateOne({ _id: lead._id, ...scopeFor(user) }, { $set: { stage } });
  revalidatePath("/leads");
  return { ok: true };
}

export async function assignOwner(
  leadId: string,
  ownerId: string,
): Promise<ActionResult> {
  "use server";
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
  "use server";
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
