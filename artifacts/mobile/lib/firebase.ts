import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBD2_B1RRQ7RSeTXYjhsUd-314juYMkOaI",
  authDomain: "ghath-c86ae.firebaseapp.com",
  databaseURL: "https://ghath-c86ae-default-rtdb.firebaseio.com",
  projectId: "ghath-c86ae",
  storageBucket: "ghath-c86ae.firebasestorage.app",
  messagingSenderId: "309047121444",
  appId: "1:309047121444:web:392d4dd79b25d8d5276ab1",
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const database = getDatabase(app);
export const auth = getAuth(app);
export default app;
