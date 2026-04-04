import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const manufacturers = pgTable("manufacturers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  manufacturerId: integer("manufacturer_id").references(
    () => manufacturers.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date"),
  manufacturerId: integer("manufacturer_id")
    .references(() => manufacturers.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectConstants = pgTable("project_constants", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  currencyRate: numeric("currency_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.710000"),
  shippingRate: numeric("shipping_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.150000"),
  customsRate: numeric("customs_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.120000"),
  profitMargin: numeric("profit_margin", { precision: 10, scale: 6 })
    .notNull()
    .default("0.250000"),
  taxRate: numeric("tax_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.160000"),
  targetCurrency: text("target_currency").notNull().default("JOD"),
});

export const accountRequests = pgTable("account_requests", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productLines = pgTable(
  "product_lines",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
    itemModel: text("item_model").notNull().default(""),
    priceUsd: numeric("price_usd", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    quantity: integer("quantity").notNull().default(1),
    shippingOverride: numeric("shipping_override", { precision: 12, scale: 4 }),
    customsOverride: numeric("customs_override", { precision: 12, scale: 4 }),
  },
  (t) => [unique().on(t.projectId, t.position)]
);

export type Manufacturer = typeof manufacturers.$inferSelect;
export type NewManufacturer = typeof manufacturers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectConstants = typeof projectConstants.$inferSelect;
export type ProductLine = typeof productLines.$inferSelect;
export type AccountRequest = typeof accountRequests.$inferSelect;
export type NewAccountRequest = typeof accountRequests.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
