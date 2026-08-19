"use server";
import { addNote, assignOwner, setStage, type ActionResult } from "@/lib/leads";
import type { Stage } from "@/models/lead-enums";

export type NoteResult = ActionResult & { body?: string };

// The only POST-able surface. Each adapter reads the form and hands over to
// the data access layer, which re-derives the caller's identity and scope for
// itself — nothing here is trusted to have checked anything.
export async function setStageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return setStage(String(formData.get("leadId")), String(formData.get("stage")) as Stage);
}

export async function assignOwnerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return assignOwner(String(formData.get("leadId")), String(formData.get("ownerId")));
}

// On failure the rejected text comes back so the box can be refilled with it:
// React clears an uncontrolled form once the action resolves, and a note that
// vanishes because the write failed is exactly the data loss to avoid.
export async function addNoteAction(
  _prev: NoteResult | null,
  formData: FormData,
): Promise<NoteResult> {
  const body = String(formData.get("body") ?? "");
  const result = await addNote(String(formData.get("leadId")), body);
  return result.ok ? result : { ...result, body };
}
