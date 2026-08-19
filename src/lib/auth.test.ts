import { afterEach, beforeEach, expect, test, vi } from "vitest";

// next/headers only works inside a request; stand in for the cookie store.
const cookieJar = new Map<string, string>();
const setCookie = vi.fn((name: string, value: string) => {
  cookieJar.set(name, value);
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: setCookie,
    delete: (name: string) => cookieJar.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectSpy(url) }));

const { getCurrentUser, setDevUser, clearDevUser, hasChosenDemoUser, DEV_USER_COOKIE } =
  await import("./auth");
const { USERS } = await import("./users");

const AGENT = USERS.find((u) => u.role === "agent")!;
const ADMIN = USERS.find((u) => u.role === "admin")!;
function setNodeEnv(value: string) {
  vi.stubEnv("NODE_ENV", value as "production" | "development" | "test");
}

beforeEach(() => {
  cookieJar.clear();
  setCookie.mockClear();
  redirectSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("with no cookie, the current user is the admin", async () => {
  expect(await getCurrentUser()).toEqual(ADMIN);
});

test("in development, the dev-user cookie switches the acting user", async () => {
  cookieJar.set(DEV_USER_COOKIE, AGENT.id);
  expect(await getCurrentUser()).toEqual(AGENT);
});

test("an unknown cookie value falls back to the default user", async () => {
  cookieJar.set(DEV_USER_COOKIE, "u_not_a_real_user");
  expect(await getCurrentUser()).toEqual(ADMIN);
});

// The security test. If the NODE_ENV guard in getCurrentUser() is removed,
// this fails: anyone able to set a cookie becomes another user in production.
test("in production, the dev-user cookie is ignored entirely", async () => {
  setNodeEnv("production");
  cookieJar.set(DEV_USER_COOKIE, AGENT.id);

  const user = await getCurrentUser();

  expect(user).toEqual(ADMIN);
  expect(user.role).toBe("admin");
  expect(user.id).not.toBe(AGENT.id);
});

// Posts a *valid* user id on purpose: if it posted junk, the id check would
// reject it and this would pass whether or not the NODE_ENV guard exists.
test("in production, setDevUser writes no cookie even for a valid user id", async () => {
  setNodeEnv("production");
  const form = new FormData();
  form.set("userId", AGENT.id);

  await setDevUser(form);

  expect(setCookie).not.toHaveBeenCalled();
  expect(cookieJar.has(DEV_USER_COOKIE)).toBe(false);
});

test("in development, setDevUser writes the cookie", async () => {
  const form = new FormData();
  form.set("userId", AGENT.id);

  await setDevUser(form);

  expect(setCookie).toHaveBeenCalledWith(
    DEV_USER_COOKIE,
    AGENT.id,
    expect.objectContaining({ httpOnly: true }),
  );
});

test("setDevUser refuses an id that is not one of ours", async () => {
  const form = new FormData();
  form.set("userId", "u_injected");

  await setDevUser(form);

  expect(setCookie).not.toHaveBeenCalled();
});

// ---- the demo front door (spec 0005). Cosmetic routing only: these do not
// change getCurrentUser, whose behaviour the seven tests above still pin. ----

test("with no cookie, no demo user has been chosen", async () => {
  expect(await hasChosenDemoUser()).toBe(false);
});

test("a cookie naming a known user counts as chosen", async () => {
  cookieJar.set(DEV_USER_COOKIE, AGENT.id);
  expect(await hasChosenDemoUser()).toBe(true);
});

// A stale or hand-edited cookie must not leave someone silently acting as the
// default admin — it sends them back to the front door instead.
test("a cookie naming an unknown user does not count as chosen", async () => {
  cookieJar.set(DEV_USER_COOKIE, "u_not_a_real_user");
  expect(await hasChosenDemoUser()).toBe(false);
});

test("in production there is no front door to gate on", async () => {
  setNodeEnv("production");
  expect(await hasChosenDemoUser()).toBe(true);
});

test("clearDevUser removes the cookie and returns to /signin", async () => {
  cookieJar.set(DEV_USER_COOKIE, AGENT.id);

  await clearDevUser();

  expect(cookieJar.has(DEV_USER_COOKIE)).toBe(false);
  expect(redirectSpy).toHaveBeenCalledWith("/signin");
});

test("in production, clearDevUser is inert like setDevUser", async () => {
  setNodeEnv("production");
  cookieJar.set(DEV_USER_COOKIE, AGENT.id);

  await clearDevUser();

  expect(cookieJar.has(DEV_USER_COOKIE)).toBe(true);
  expect(redirectSpy).not.toHaveBeenCalled();
});
