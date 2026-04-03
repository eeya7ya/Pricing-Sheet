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

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
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
