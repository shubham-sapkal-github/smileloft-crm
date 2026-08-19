// Deliberately free of `server-only` and of any Next import: this list is
// needed by the server (permission checks), by the seed script (plain Node),
// and by the dev switcher dropdown (a Client Component). Same reasoning as
// src/models/lead-enums.ts — shared constants must not drag the server-only
// runtime along with them.
export type Role = "admin" | "agent";
export type User = { id: string; name: string; role: Role };

// TODO: hardcoded until real auth exists. This list and getCurrentUser() in
// ./auth.ts are the only things that change when it arrives.
export const USERS: readonly User[] = [
  { id: "u_admin", name: "Priya Shah", role: "admin" },
  { id: "u_agent", name: "Tom Reid", role: "agent" },
];

export const DEFAULT_USER: User = USERS[0];
