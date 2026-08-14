"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS: { label: string; href: string; match: (p: string) => boolean }[] = [
  { label: "Fila", href: "/", match: (p) => p === "/" },
  {
    label: "Chamados",
    href: "/chamados",
    match: (p) => p.startsWith("/chamados"),
  },
  { label: "Tasks", href: "/tasks", match: (p) => p.startsWith("/tasks") },
  {
    label: "Projetos",
    href: "/projects",
    match: (p) => p.startsWith("/projects"),
  },
  { label: "Equipe", href: "/team", match: (p) => p.startsWith("/team") },
];

/** Menu do dashboard — presente em toda tela interna; o portal do cliente não o vê. */
export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-[160px] shrink-0 flex-col border-r-2 border-rule">
      <ul className="pt-3">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-8 items-center px-4 text-[13px]",
                  active
                    ? "bg-row-sel font-semibold"
                    : "text-foreground hover:bg-row-hover",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
