import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type Role = "admin" | "agent";
export type User = { id: string; name: string; role: Role };

// TODO: hardcoded until real auth exists. This list and getCurrentUser() are
// the only things that change when it arrives — nothing else in the codebase
// reads identity from anywhere else.
export const USERS: readonly User[] = [
  { id: "u_admin", name: "Priya Shah", role: "admin" },
  { id: "u_agent", name: "Tom Reid", role: "agent" },
];

export const DEFAULT_USER: User = USERS[0];
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
