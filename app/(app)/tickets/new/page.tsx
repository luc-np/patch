import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listProjectsForActor } from "@/services/projects";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");
  const projects = await listProjectsForActor(actor);

  const params = await searchParams;
  const typeParam = typeof params.type === "string" ? params.type : "task";
  const defaultType = ["task", "bug", "support"].includes(typeParam)
    ? (typeParam as "task" | "bug" | "support")
    : "task";

  return <NewTicketForm projects={projects} defaultType={defaultType} />;
}
