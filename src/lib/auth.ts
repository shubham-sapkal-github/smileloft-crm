import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { USERS, DEFAULT_USER, type User } from "./users";

export type { Role, User } from "./users";

export const DEV_USER_COOKIE = "dev-user";

/**
 * The dev switcher is a way to become another user by setting a cookie. In
 * production that is an authentication bypass, so it is disabled by NODE_ENV
 * and the check lives here, on the server, in the one function every
 * permission check goes through.
 */
export function isDevSwitcherEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export const getCurrentUser = cache(async (): Promise<User> => {
  if (!isDevSwitcherEnabled()) return DEFAULT_USER;

  const impersonatedId = (await cookies()).get(DEV_USER_COOKIE)?.value;
  return USERS.find((user) => user.id === impersonatedId) ?? DEFAULT_USER;
});

export async function setDevUser(formData: FormData) {
  "use server";
  if (!isDevSwitcherEnabled()) return;

  const id = String(formData.get("userId") ?? "");
  // Only an id that is actually one of ours — never write back what was posted.
  if (!USERS.some((user) => user.id === id)) return;

  (await cookies()).set(DEV_USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/", "layout");
}

/**
 * Whether a known demo user has been chosen. Deliberately separate from
 * getCurrentUser(), which must keep returning the default user when there is
 * no cookie — two tests pin that, one of them the production guard.
 *
 * This is a COSMETIC routing check, not an access control: anyone can reach
 * /signin and pick the admin, and every Server Action stays directly callable
 * without ever visiting it. See docs/specs/0005-app-shell.md.
 */
export async function hasChosenDemoUser(): Promise<boolean> {
  if (!isDevSwitcherEnabled()) return true;
  const chosen = (await cookies()).get(DEV_USER_COOKIE)?.value;
  // An unknown id counts as not chosen, so a stale or hand-edited cookie
  // cannot leave someone silently acting as the default admin.
  return USERS.some((user) => user.id === chosen);
}

export async function clearDevUser() {
  "use server";
  if (!isDevSwitcherEnabled()) return;
  (await cookies()).delete(DEV_USER_COOKIE);
  redirect("/signin");
}
