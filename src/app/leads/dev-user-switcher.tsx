import { USERS } from "@/lib/users";
import { getCurrentUser, isDevSwitcherEnabled, setDevUser } from "@/lib/auth";

// A plain form: no client JS, and it works with the button alone. Renders
// nothing in production, where setDevUser and getCurrentUser both ignore it
// anyway — the guard that matters is on the server, this is just tidiness.
export default async function DevUserSwitcher() {
  if (!isDevSwitcherEnabled()) return null;

  const current = await getCurrentUser();

  return (
    <form
      action={setDevUser}
      className="flex items-center gap-2 rounded-md border border-dashed border-amber-400/70 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-500/40 dark:bg-amber-950/30"
    >
      <span className="font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
        Dev only
      </span>
      <label htmlFor="userId" className="sr-only">
        Act as
      </label>
      <select
        // Remount when the acting user changes: React leaves an uncontrolled
        // select's DOM value alone across the post-action re-render, so
        // without this the dropdown can disagree with the header.
        key={current.id}
        id="userId"
        name="userId"
        defaultValue={current.id}
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {USERS.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.role})
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-2.5 py-1 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Switch
      </button>
    </form>
  );
}
