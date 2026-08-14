import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getProjectBySlug } from "@/services/projects";
import { EditProjectForm } from "./edit-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/projects");

  const { slug } = await params;
  const result = await getProjectBySlug(actor, slug);
  if (!result.ok) notFound();
  const p = result.value;

  return (
    <EditProjectForm
      project={{
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description ?? "",
        repoUrl: p.repoUrl ?? "",
        defaultBranch: p.defaultBranch,
        portalEnabled: p.portalEnabled,
        accentColor: p.accentColor ?? "",
      }}
    />
  );
}
