import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasChosenDemoUser } from "@/lib/auth";
import Sidebar from "./sidebar";
import Toolbar from "./toolbar";
import { SIDEBAR_COOKIE } from "./shell-cookie";

export default async function LeadsLayout({ children }: LayoutProps<"/leads">) {
  // Cosmetic front door, not an access control: it only decides where you land.
  // hasChosenDemoUser() returns true in production, so nothing changes there.
  if (!(await hasChosenDemoUser())) redirect("/signin");

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-full w-full bg-zinc-50 dark:bg-zinc-950">
      <Sidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
