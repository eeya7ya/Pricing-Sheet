import { db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { hashPassword } from "./auth";

let ensuredSchema = false;
let ensuredAdmin = false;

/**
 * Idempotently creates/alters tables that are added to the schema after
 * the initial deployment. Drizzle-kit is not wired into the server runtime,
 * so we run raw SQL guarded by IF NOT EXISTS.
 */
export async function ensureSchema() {
  if (ensuredSchema) return;
  try {
    // audit_logs — new table for tracking admin/user actions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_user_id INTEGER,
        actor_email TEXT,
        actor_name TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC)
    `);

    // projects.user_id — per-user ownership for project-level visibility
    await db.execute(sql`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id)
    `);

    ensuredSchema = true;
  } catch (e) {
    console.error("[ensureSchema] failed:", e);
  }
}

/**
 * Ensures a hardcoded "admin" login exists with password "admin123".
 * The username is intentionally the literal string "admin" (not an email)
 * so admins can sign in quickly. On first call, creates or repairs the row.
 */
export async function ensureAdminUser() {
  if (ensuredAdmin) return;
  try {
    const admin = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, "admin"),
    });
    if (!admin) {
      const passwordHash = await hashPassword("admin123");
      await db.insert(users).values({
        email: "admin",
        passwordHash,
        fullName: "Administrator",
        role: "admin",
        manufacturerId: null,
      });
    } else if (admin.role !== "admin") {
      // Repair: make sure the account keeps admin privileges.
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    }
    ensuredAdmin = true;
  } catch (e) {
    console.error("[ensureAdminUser] failed:", e);
  }
}
