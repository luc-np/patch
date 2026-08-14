import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/");
  return <NewProjectForm />;
}
