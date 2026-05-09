import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  fullName: text("full_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("patient"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  doctorName: text("doctor_name"),
  clinicName: text("clinic_name"),
  bookingDate: timestamp("booking_date"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const medicineOrdersTable = pgTable("medicine_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  medicineName: text("medicine_name").notNull(),
  pharmacyName: text("pharmacy_name"),
  status: text("status").notNull().default("pending"),
  quantity: integer("quantity").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = typeof bookingsTable.$inferInsert;

export type MedicineOrder = typeof medicineOrdersTable.$inferSelect;
export type InsertMedicineOrder = typeof medicineOrdersTable.$inferInsert;
