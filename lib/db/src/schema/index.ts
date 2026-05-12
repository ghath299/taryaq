import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  doublePrecision,
  boolean,
  real,
} from "drizzle-orm/pg-core";

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

export const pharmaciesTable = pgTable("pharmacies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull().unique(),
  licenseImage: text("license_image"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  address: text("address"),
  status: text("status").notNull().default("pending"),
  isAvailable: boolean("is_available").notNull().default(false),
  rating: real("rating").notNull().default(0),
  totalRatings: integer("total_ratings").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const medicationRequestsTable = pgTable("medication_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  medicationName: text("medication_name").notNull(),
  medicationImage: text("medication_image"),
  searchRadius: integer("search_radius").notNull().default(500),
  status: text("status").notNull().default("searching"),
  cancelReason: text("cancel_reason"),
  patientLat: doublePrecision("patient_lat").notNull(),
  patientLng: doublePrecision("patient_lng").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pharmacyResponsesTable = pgTable("pharmacy_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => medicationRequestsTable.id, { onDelete: "cascade" }),
  pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  respondedAt: timestamp("responded_at"),
  confirmedAt: timestamp("confirmed_at"),
  pharmacyDeliveredAt: timestamp("pharmacy_delivered_at"),
  patientReceivedAt: timestamp("patient_received_at"),
  cancelReason: text("cancel_reason"),
});

export const patientMedicationsTable = pgTable("patient_medications", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  medicationName: text("medication_name").notNull(),
  medicationImage: text("medication_image"),
  dailyDoses: integer("daily_doses").notNull().default(1),
  pillsPerDose: integer("pills_per_dose").notNull().default(1),
  totalPills: integer("total_pills").notNull().default(0),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  isChronic: boolean("is_chronic").notNull().default(false),
  lastPharmacyId: uuid("last_pharmacy_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const medicationRemindersTable = pgTable("medication_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientMedicationId: uuid("patient_medication_id").notNull().references(() => patientMedicationsTable.id, { onDelete: "cascade" }),
  reminderDate: timestamp("reminder_date").notNull(),
  isSent: boolean("is_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pharmacyRatingsTable = pgTable("pharmacy_ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }),
  patientId: uuid("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull().references(() => medicationRequestsTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const violationsTable = pgTable("violations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  userType: text("user_type").notNull().default("patient"),
  type: text("type").notNull(),
  requestId: uuid("request_id"),
  isBanned: boolean("is_banned").notNull().default(false),
  banUntil: timestamp("ban_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pharmacyWalletsTable = pgTable("pharmacy_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }).unique(),
  balance: real("balance").notNull().default(0),
  totalEarned: real("total_earned").notNull().default(0),
  totalDeducted: real("total_deducted").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pharmacyId: uuid("pharmacy_id").notNull().references(() => pharmaciesTable.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  type: text("type").notNull(),
  method: text("method"),
  transferCode: text("transfer_code"),
  status: text("status").notNull().default("pending"),
  confirmedBy: uuid("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = typeof bookingsTable.$inferInsert;

export type MedicineOrder = typeof medicineOrdersTable.$inferSelect;
export type InsertMedicineOrder = typeof medicineOrdersTable.$inferInsert;

export type Pharmacy = typeof pharmaciesTable.$inferSelect;
export type InsertPharmacy = typeof pharmaciesTable.$inferInsert;

export type MedicationRequest = typeof medicationRequestsTable.$inferSelect;
export type InsertMedicationRequest = typeof medicationRequestsTable.$inferInsert;

export type PatientMedication = typeof patientMedicationsTable.$inferSelect;
export type InsertPatientMedication = typeof patientMedicationsTable.$inferInsert;

export type PharmacyRating = typeof pharmacyRatingsTable.$inferSelect;
export type Violation = typeof violationsTable.$inferSelect;
export type PharmacyWallet = typeof pharmacyWalletsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
