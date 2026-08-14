import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, projects, projectMembers, tickets } from "@/db/schema";
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

  // Alguns chamados de demonstração para a fila não nascer vazia em dev.
  const existingTickets = await db.query.tickets.findMany({
    where: eq(tickets.projectId, project.id),
    limit: 1,
  });
  if (existingTickets.length === 0) {
    await db.insert(tickets).values([
      {
        projectId: project.id,
        type: "support",
        title: "Erro 500 ao finalizar pagamento com Pix",
        body: "Tentei pagar com Pix e a tela ficou carregando; depois apareceu um erro. O pedido era o #48213.",
        origin: "portal",
        authorId: admin.id,
        status: "open",
      },
      {
        projectId: project.id,
        type: "bug",
        title: "Cupom aplicado duas vezes no resumo do pedido",
        body: "Reproduzido em staging: aplicar cupom, voltar, aplicar de novo — o desconto soma.",
        origin: "internal",
        authorId: admin.id,
        assigneeId: admin.id,
        status: "in_analysis",
      },
      {
        projectId: project.id,
        type: "task",
        title: "Atualizar runbook de reprocessamento de pedidos",
        body: "O runbook em docs/runbooks/reprocessamento.md ainda cita a fila antiga.",
        origin: "internal",
        authorId: admin.id,
        status: "open",
        dueAt: new Date(),
      },
    ]);
    console.log("3 chamados de demonstração criados");
  }

  console.log("seed concluído.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
