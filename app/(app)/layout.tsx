import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/patch/theme-toggle";
import { NavSidebar } from "@/components/patch/nav-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  // O app interno é do time; o autor externo vive no portal.
  if (actor.role === "guest") redirect("/meus-chamados");

  return (
    <div id="app-shell">
      <header className="rule-b flex h-[46px] shrink-0 items-center gap-6 px-4">
        <Link
          href="/"
          className="text-[15px] font-extrabold tracking-tight text-foreground"
        >
          Patch
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/design"
            className="font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            §design
          </Link>
          <ThemeToggle />
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {actor.name.toLowerCase()}
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <NavSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
