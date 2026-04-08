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

    // manufacturers.color / manufacturers.tag — visual disambiguation
    // for duplicate brand names (e.g. two "DSPPA" rows for different
    // customers).
    await db.execute(sql`
      ALTER TABLE manufacturers
      ADD COLUMN IF NOT EXISTS color TEXT
    `);
    await db.execute(sql`
      ALTER TABLE manufacturers
      ADD COLUMN IF NOT EXISTS tag TEXT
    `);

    // users.email -> users.username migration. This app is now
    // username-only (no email). The rename is idempotent: if the
    // username column already exists we skip, otherwise we rename.
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'email'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'username'
        ) THEN
          ALTER TABLE users RENAME COLUMN email TO username;
        END IF;
      END $$;
    `);
    // If the original table pre-dates the rename, the unique index was
    // named users_email_key — rename it too so it lines up with the
    // column. Safe to run repeatedly.
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'users' AND indexname = 'users_email_key'
        ) THEN
          ALTER INDEX users_email_key RENAME TO users_username_key;
        END IF;
      END $$;
    `);

    // users.color — one accent color per user, applied to all their manufacturers
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'cyan'
    `);

    // product_lines: per-row rate overrides (shipping, customs, profit) —
    // decimal percentages that take precedence over global constants for
    // a single row. Added idempotently for existing deployments.
    await db.execute(sql`
      ALTER TABLE product_lines
      ADD COLUMN IF NOT EXISTS shipping_rate_override NUMERIC(10, 6)
    `);
    await db.execute(sql`
      ALTER TABLE product_lines
      ADD COLUMN IF NOT EXISTS customs_rate_override NUMERIC(10, 6)
    `);
    await db.execute(sql`
      ALTER TABLE product_lines
      ADD COLUMN IF NOT EXISTS profit_rate_override NUMERIC(10, 6)
    `);

    // user_manufacturers — per-user color/tag for each manufacturer
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_manufacturers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        manufacturer_id INTEGER NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
        color TEXT NOT NULL DEFAULT 'cyan',
        tag TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP,
        UNIQUE(user_id, manufacturer_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_manufacturers_user_id_idx ON user_manufacturers (user_id)
    `);
    // Migrate existing per-user color/tag data from manufacturers into the
    // new junction table. Safe to run repeatedly thanks to ON CONFLICT DO NOTHING.
    await db.execute(sql`
      INSERT INTO user_manufacturers (user_id, manufacturer_id, color, tag, created_at)
      SELECT
        created_by_user_id,
        id,
        COALESCE(NULLIF(color, ''), 'cyan'),
        COALESCE(tag, ''),
        created_at
      FROM manufacturers
      WHERE created_by_user_id IS NOT NULL
        AND deleted_at IS NULL
      ON CONFLICT (user_id, manufacturer_id) DO NOTHING
    `);

    ensuredSchema = true;
  } catch (e) {
    console.error("[ensureSchema] failed:", e);
  }
}

/**
 * Ensures a hardcoded "admin" login exists with password "admin123".
 * On first call creates or repairs the row.
 */
export async function ensureAdminUser() {
  if (ensuredAdmin) return;
  try {
    const admin = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.username, "admin"),
    });
    if (!admin) {
      const passwordHash = await hashPassword("admin123");
      await db.insert(users).values({
        username: "admin",
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
