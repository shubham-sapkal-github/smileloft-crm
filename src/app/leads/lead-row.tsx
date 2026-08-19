"use client";

import { useActionState } from "react";
import { USERS } from "@/lib/users";
import { STAGES } from "@/models/lead-enums";
import type { LeadListItem } from "@/lib/leads";
import {
  addNoteAction,
  assignOwnerAction,
  setStageAction,
  setStatusAction,
} from "./actions";
import { STAGE_STYLES } from "./stage-styles";

const CELL = "px-4 py-3 align-top";
const CONTROL =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const BUTTON =
  "rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

function ActionError({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state || state.ok) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{state.error}</p>;
}

export default function LeadRow({
  lead,
  canAssign,
}: {
  lead: LeadListItem;
  canAssign: boolean;
}) {
  const [stageState, stageSubmit, stagePending] = useActionState(setStageAction, null);
  const [ownerState, ownerSubmit, ownerPending] = useActionState(assignOwnerAction, null);
  const [noteState, noteSubmit, notePending] = useActionState(addNoteAction, null);
  const [statusState, statusSubmit, statusPending] = useActionState(setStatusAction, null);

  // React clears the form once the action resolves, so a failed note is put
  // back from what the action returned. Remounting on change is what makes the
  // new defaultValue take effect.
  const rejectedNote = noteState && !noteState.ok ? (noteState.body ?? "") : "";

  return (
    <tr
      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${
        lead.status === "Archived" ? "opacity-60" : ""
      }`}
    >
      {/* Patient: who they are and how to reach them. */}
      <td className={CELL}>
        <div className="font-medium">{lead.name}</div>
        {lead.email && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{lead.email}</div>
        )}
        {lead.phone && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{lead.phone}</div>
        )}
      </td>

      {/* Enquiry: what they asked for and where they are coming from. */}
      <td className={CELL}>
        <div>{lead.treatmentInterest ?? "—"}</div>
        {lead.location && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{lead.location}</div>
        )}
      </td>

      <td className={CELL}>
        <span
          className={`mb-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${STAGE_STYLES[lead.stage]}`}
        >
          {lead.stage}
        </span>
        <form action={stageSubmit} className="flex items-center gap-1">
          <input type="hidden" name="leadId" value={lead.id} />
          <select name="stage" defaultValue={lead.stage} className={CONTROL} key={lead.stage}>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          <button type="submit" className={BUTTON} disabled={stagePending}>
            {stagePending ? "…" : "Move"}
          </button>
        </form>
        <ActionError state={stageState} />
      </td>

      <td className={CELL}>
        <div className="mb-1.5 text-zinc-600 dark:text-zinc-400">{lead.status}</div>
        {/* Archiving is the undo this app has: nothing is deleted, it is filed
            away. Same permission rule as every other row action. */}
        <form action={statusSubmit}>
          <input type="hidden" name="leadId" value={lead.id} />
          <input
            type="hidden"
            name="status"
            value={lead.status === "Active" ? "Archived" : "Active"}
          />
          <button type="submit" className={BUTTON} disabled={statusPending}>
            {statusPending ? "…" : lead.status === "Active" ? "Archive" : "Unarchive"}
          </button>
        </form>
        <ActionError state={statusState} />
      </td>

      <td className={CELL}>
        <div className="mb-1.5 text-zinc-600 dark:text-zinc-400">
          {lead.ownerName ?? "Unassigned"}
        </div>
        {/* Admin only. The server refuses an agent regardless — see actions.ts
            and src/lib/leads.ts; hiding this is tidiness, not the control. */}
        {canAssign && (
          <>
            <form action={ownerSubmit} className="flex items-center gap-1">
              <input type="hidden" name="leadId" value={lead.id} />
              <select
                name="ownerId"
                defaultValue={lead.ownerId ?? ""}
                className={CONTROL}
                key={lead.ownerId ?? "none"}
              >
                {lead.ownerId === null && <option value="">Unassigned</option>}
                {USERS.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <button type="submit" className={BUTTON} disabled={ownerPending}>
                {ownerPending ? "…" : "Assign"}
              </button>
            </form>
            <ActionError state={ownerState} />
          </>
        )}
      </td>

      <td className={CELL}>
        {lead.notes.length > 0 && (
          <div className="mb-1.5">
            <p
              title={lead.notes.at(-1)!.body}
              className="max-w-[15rem] truncate text-xs text-zinc-600 dark:text-zinc-400"
            >
              {lead.notes.at(-1)!.body}
              <span className="text-zinc-400 dark:text-zinc-500">
                {" "}
                — {lead.notes.at(-1)!.authorName}
              </span>
            </p>
            {lead.notes.length > 1 && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                +{lead.notes.length - 1} earlier
              </p>
            )}
          </div>
        )}
        <form action={noteSubmit} className="flex items-start gap-1">
          <input type="hidden" name="leadId" value={lead.id} />
          <input
            name="body"
            defaultValue={rejectedNote}
            key={`${rejectedNote}-${lead.notes.length}`}
            placeholder="Add a note"
            className={`${CONTROL} w-40`}
          />
          <button type="submit" className={BUTTON} disabled={notePending}>
            {notePending ? "…" : "Add"}
          </button>
        </form>
        <ActionError state={noteState} />
      </td>
    </tr>
  );
}
