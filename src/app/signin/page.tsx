import { USERS } from "@/lib/users";
import { isDevSwitcherEnabled } from "@/lib/auth";
import { chooseDemoUser } from "./actions";

export const metadata = { title: "Sign in — SmileLoft Dental" };

export default function SignInPage() {
  const enabled = isDevSwitcherEnabled();

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-zinc-100 px-6 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <h1 className="text-center text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          SmileLoft Dental
        </h1>

        {/* Said on the page, not only in the code: a screen that looks like a
            login invites people to assume something is being protected. */}
        <div className="mt-4 rounded-md border border-dashed border-amber-400/70 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold uppercase tracking-wide">Demo front door</p>
          <p className="mt-1">
            This is <strong>not</strong> authentication. There are no passwords and no
            sessions — pick which demo user you want to be. Anyone can choose any user
            here. Real sign-in is still to be built.
          </p>
        </div>

        {enabled ? (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Continue as</p>
            <ul className="space-y-2">
              {USERS.map((user) => (
                <li key={user.id}>
                  <form action={chooseDemoUser}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {user.name}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {user.role}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
              No sign up — these two users are hardcoded.
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            The demo user switcher is disabled in production.
          </p>
        )}
      </div>
    </div>
  );
}
