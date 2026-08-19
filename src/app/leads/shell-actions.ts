"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SIDEBAR_COOKIE } from "./shell-cookie";

// A cookie rather than localStorage: it is read during the server render, so
// the first paint is already correct. localStorage would render expanded and
// collapse after paint, flashing on every load.
export async function toggleSidebar() {
  const jar = await cookies();
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";
  jar.set(SIDEBAR_COOKIE, collapsed ? "expanded" : "collapsed", {
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/leads");
}
