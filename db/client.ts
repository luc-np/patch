import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/* Único ponto de conexão com o Postgres (web, worker e scripts). */
const globalForDb = globalThis as unknown as {
  __patchPool?: Pool;
};

function getPool(): Pool {
  if (!globalForDb.__patchPool) {
    globalForDb.__patchPool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
    });
  }
  return globalForDb.__patchPool;
}

export const db = drizzle({ client: getPool(), schema });

export type Db = typeof db;
