"use server";
import { redirect } from "next/navigation";
import { setDevUser } from "@/lib/auth";

// setDevUser is left exactly as it is — its production guard and its tests are
// untouched. This wrapper only adds where you land afterwards.
export async function chooseDemoUser(formData: FormData) {
  await setDevUser(formData);
  redirect("/leads");
}
