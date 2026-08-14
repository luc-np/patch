import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/patch/theme-toggle";

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
        <Link href="/" className="text-[15px] font-extrabold tracking-tight text-foreground">
          Patch
        </Link>
        <nav className="flex items-center gap-4 text-[13px]">
          <Link href="/" className="text-foreground hover:underline hover:underline-offset-3">
            fila
          </Link>
          <Link
            href="/team"
            className="text-foreground hover:underline hover:underline-offset-3"
          >
            equipe
          </Link>
        </nav>
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
      {children}
    </div>
  );
}
