import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listProjectsForActor } from "@/services/projects";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  const actor = await getActor();
  if (!actor || actor.role === "guest") redirect("/login");
  const projects = await listProjectsForActor(actor);
  return <NewTicketForm projects={projects} />;
}
