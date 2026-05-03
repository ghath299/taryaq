import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { logger } from "./logger";

let app: App | null = null;
let db: Database | null = null;
let initFailed = false;

const DEFAULT_DB_URL = "https://ghath-c86ae-default-rtdb.firebaseio.com";

function init(): void {
  if (app || initFailed) return;
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) {
    logger.warn("[firebase-admin] FIREBASE_SERVICE_ACCOUNT not set — Firebase persistence disabled");
    initFailed = true;
    return;
  }
  try {
    const parsed = JSON.parse(raw) as {
      project_id: string;
      private_key: string;
      client_email: string;
    };
    const databaseURL =
      process.env["FIREBASE_DATABASE_URL"] ?? `https://${parsed.project_id}-default-rtdb.firebaseio.com`;
    const existing = getApps()[0];
    app =
      existing ??
      initializeApp({
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        }),
        databaseURL: databaseURL || DEFAULT_DB_URL,
      });
    db = getDatabase(app);
    logger.info({ projectId: parsed.project_id }, "[firebase-admin] initialized");
  } catch (err) {
    logger.error({ err }, "[firebase-admin] init failed — falling back to in-memory");
    initFailed = true;
  }
}

export function fbDb(): Database | null {
  if (!app && !initFailed) init();
  return db;
}

export function fbReady(): boolean {
  if (!app && !initFailed) init();
  return db !== null;
}
