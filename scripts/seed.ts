import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, projects, projectMembers } from "@/db/schema";
import { auth } from "@/lib/auth/auth";

/**
 * Seed de desenvolvimento: cria o admin inicial (único caminho para admin)
 * e um projeto de exemplo. Idempotente: rodar de novo não duplica nada.
 */
async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@patch.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "patch-admin-123";

  let admin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (!admin) {
    await auth.api.signUpEmail({
      body: { name: "Admin", email: adminEmail, password: adminPassword },
    });
    await db
      .update(users)
      .set({ role: "admin", emailVerified: true })
      .where(eq(users.email, adminEmail));
    admin = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });
    console.log(`admin criado: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`admin já existe: ${adminEmail}`);
  }
  if (!admin) throw new Error("seed: admin não encontrado após criação");

  let project = await db.query.projects.findFirst({
    where: eq(projects.slug, "checkout"),
  });
  if (!project) {
    const [created] = await db
      .insert(projects)
      .values({
        name: "Checkout",
        slug: "checkout",
        description: "Fluxo de pagamento e finalização de pedido",
        portalEnabled: true,
      })
      .returning();
    project = created;
    console.log("projeto de exemplo criado: checkout");
  }
  if (!project) throw new Error("seed: projeto não encontrado após criação");

  await db
    .insert(projectMembers)
    .values({ projectId: project.id, userId: admin.id, role: "po" })
    .onConflictDoNothing();

  console.log("seed concluído.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
