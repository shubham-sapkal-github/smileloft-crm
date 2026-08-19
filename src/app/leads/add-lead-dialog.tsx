"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLeadAction } from "./actions";

type Field = {
  name: "name" | "email" | "phone" | "location" | "treatmentInterest";
  label: string;
  type?: string;
  required?: boolean;
};

const FIELDS: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "location", label: "Location" },
  { name: "treatmentInterest", label: "Treatment interest" },
];

const INPUT =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function AddLeadDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, submit, pending] = useActionState(createLeadAction, null);
  const failed = state && !state.ok ? state : null;

  // A successful create revalidates and re-renders the page, which would leave
  // the dialog sitting open; a failed one must NOT close, or five typed fields
  // vanish along with it. So the dialog's open state follows the result.
  useEffect(() => {
    const element = dialog.current;
    if (!element || !state) return;
    if (state.ok) element.close();
    else if (!element.open) element.showModal();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Add a lead
      </button>

      <dialog
        ref={dialog}
        aria-label="Add a lead"
        // Clicking the backdrop is a click on the dialog element itself; the
        // content sits in its own box, so its clicks never match.
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
        className="m-auto w-full max-w-2xl rounded-lg bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <form action={submit} className="p-5">
          <h2 className="text-sm font-semibold">Add a lead</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {field.label}
                  {field.required && <span className="text-rose-600"> *</span>}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? "text"}
                  maxLength={200}
                  className={INPUT}
                  // Refilled from what the action handed back, remounted by key
                  // so the new default takes effect.
                  defaultValue={failed ? failed.values[field.name] : ""}
                  key={`${field.name}-${failed ? failed.values[field.name] : ""}`}
                />
                {failed?.errors[field.name] && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    {failed.errors[field.name]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Name, and at least one of email or phone.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {pending ? "Adding…" : "Add lead"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
