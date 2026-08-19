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
const GHOST_SELECT =
  "max-w-[9rem] cursor-pointer truncate rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-700 hover:border-zinc-300 focus:border-zinc-400 dark:text-zinc-300 dark:hover:border-zinc-600";
const ACTION_BUTTON =
  "rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function ActionError({ state }: { state: { ok: boolean; error?: string } | null }) {
  if (!state || state.ok) return null;
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{state.error}</p>;
}

// The select is the control and the label at once — changing it submits, so
// there is no second button repeating what it already says.
const submitOnChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
  event.currentTarget.form?.requestSubmit();

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

  const rejectedNote = noteState && !noteState.ok ? (noteState.body ?? "") : "";
  const latestNote = lead.notes.at(-1);

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
        <form action={stageSubmit}>
          <input type="hidden" name="leadId" value={lead.id} />
          <label className="sr-only" htmlFor={`stage-${lead.id}`}>
            Stage
          </label>
          <select
            id={`stage-${lead.id}`}
            name="stage"
            defaultValue={lead.stage}
            key={lead.stage}
            onChange={submitOnChange}
            disabled={stagePending}
            // Styled as the chip it replaces: reads as a label until used.
            className={`cursor-pointer appearance-none rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${STAGE_STYLES[lead.stage]}`}
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </form>
        <ActionError state={stageState} />
      </td>

      <td className={`${CELL} text-sm text-zinc-600 dark:text-zinc-400`}>{lead.status}</td>

      <td className={CELL}>
        {canAssign ? (
          <>
            <form action={ownerSubmit}>
              <input type="hidden" name="leadId" value={lead.id} />
              <label className="sr-only" htmlFor={`owner-${lead.id}`}>
                Owner
              </label>
              <select
                id={`owner-${lead.id}`}
                name="ownerId"
                defaultValue={lead.ownerId ?? ""}
                key={lead.ownerId ?? "none"}
                onChange={submitOnChange}
                disabled={ownerPending}
                className={GHOST_SELECT}
              >
                {lead.ownerId === null && <option value="">Unassigned</option>}
                {USERS.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </form>
            <ActionError state={ownerState} />
          </>
        ) : (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {lead.ownerName ?? "Unassigned"}
          </span>
        )}
      </td>

      <td className={CELL}>
        {latestNote && (
          <p
            title={latestNote.body}
            className="max-w-[16rem] truncate text-xs text-zinc-600 dark:text-zinc-400"
          >
            {latestNote.body}
            <span className="text-zinc-400 dark:text-zinc-500"> — {latestNote.authorName}</span>
          </p>
        )}
        {lead.notes.length > 1 && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            +{lead.notes.length - 1} earlier
          </p>
        )}
        {/* Behind a native disclosure so it costs no permanent row height. */}
        <details className="mt-1">
          <summary className="w-fit cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300">
            Add note
          </summary>
          <form action={noteSubmit} className="mt-1.5 flex items-start gap-1">
            <input type="hidden" name="leadId" value={lead.id} />
            <input
              name="body"
              defaultValue={rejectedNote}
              key={`${rejectedNote}-${lead.notes.length}`}
              placeholder="Add a note"
              aria-label="Note"
              className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button type="submit" className={ACTION_BUTTON} disabled={notePending}>
              {notePending ? "…" : "Add"}
            </button>
          </form>
          <ActionError state={noteState} />
        </details>
      </td>

      {/* One column for the controls that are not also a value. */}
      <td className={CELL}>
        <form action={statusSubmit}>
          <input type="hidden" name="leadId" value={lead.id} />
          <input
            type="hidden"
            name="status"
            value={lead.status === "Active" ? "Archived" : "Active"}
          />
          <button type="submit" className={ACTION_BUTTON} disabled={statusPending}>
            {statusPending ? "…" : lead.status === "Active" ? "Archive" : "Unarchive"}
          </button>
        </form>
        <ActionError state={statusState} />
      </td>
    </tr>
  );
}
