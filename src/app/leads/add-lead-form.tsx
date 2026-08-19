"use client";

import { useActionState } from "react";
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

export default function AddLeadForm() {
  const [state, submit, pending] = useActionState(createLeadAction, null);
  const failed = state && !state.ok ? state : null;

  return (
    <details className="mb-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">Add a lead</summary>

      <form action={submit} className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                // React clears an uncontrolled form once the action resolves,
                // so a rejected submission is refilled from what came back —
                // five retyped fields is a real loss. The key remounts the
                // input so the new defaultValue takes effect.
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

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pending ? "Adding…" : "Add lead"}
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Name, and at least one of email or phone.
          </p>
          {state?.ok && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Added {state.name}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
