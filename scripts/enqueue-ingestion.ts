import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { enqueue, QUEUE } from "@/lib/queue";

/**
 * Chamado pelo Cron Job do Render a cada 30 min (e à mão quando preciso):
 * enfileira a sincronização de todo projeto com repositório configurado.
 * singletonKey por projeto evita runs concorrentes do mesmo repo.
 */
async function main() {
  const withRepo = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(isNotNull(projects.repoUrl));

  for (const project of withRepo) {
    const jobId = await enqueue(
      QUEUE.ingestion,
      { projectId: project.id },
      { singletonKey: project.id, retryLimit: 1 },
    );
    console.log(
      JSON.stringify({ msg: "ingestão enfileirada", slug: project.slug, jobId }),
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
