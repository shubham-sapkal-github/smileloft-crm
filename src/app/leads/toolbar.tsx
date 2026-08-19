import { clearDevUser, getCurrentUser } from "@/lib/auth";

export const PRACTICE_NAME = "SmileLoft Dental";

export default async function Toolbar() {
  const user = await getCurrentUser();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {PRACTICE_NAME}
      </span>

      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.name}</span>{" "}
          ({user.role})
        </span>
        <form action={clearDevUser}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
