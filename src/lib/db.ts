import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

type DrizzleDb =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzlePg<typeof schema>>;

let _db: DrizzleDb | null = null;

/**
 * Pick the right driver based on DATABASE_URL:
 *  - *.neon.tech URLs → Neon's HTTP driver (best for serverless on Vercel).
 *  - Everything else (Supabase, plain Postgres, RDS, Docker…) → postgres.js
 *    over the standard PostgreSQL wire protocol.
 *
 * This lets you migrate databases just by changing DATABASE_URL — no code
 * change needed.
 */
function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    return host.endsWith(".neon.tech") || host.endsWith(".neon.database.io");
  } catch {
    return false;
  }
}

export function getDb(): DrizzleDb {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set.");
    }

    if (isNeonUrl(url)) {
      const sql = neon(url);
      _db = drizzleNeon(sql, { schema });
    } else {
      // Standard PostgreSQL (Supabase, self-hosted, RDS, etc.).
      // `prepare: false` keeps us compatible with Supabase's transaction-
      // mode pooler (pgbouncer doesn't support prepared statements).
      const client = postgres(url, { prepare: false });
      _db = drizzlePg(client, { schema });
    }
  }
  return _db;
}

// Convenience re-export — lazy proxy so the connection isn't opened until first call
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb();
    return (instance as any)[prop];
  },
});
