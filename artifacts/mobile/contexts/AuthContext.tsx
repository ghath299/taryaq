import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { saveUser as saveUserToFirebase } from "@/lib/firebase-data";
import {
  saveTokens,
  clearTokens,
  getStoredTokens,
  getValidAccessToken,
} from "@/lib/auth-tokens";
import { logger } from "@/lib/logger";

export type UserRole = "patient" | "doctor" | "pharmacist" | null;

export interface AuthUser {
  id?: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  locationGranted: boolean;
  isVerified: boolean;
  avatarUri?: string;
}

interface OTPResult {
  success: boolean;
  message?: string;
  attemptsRemaining?: number;
  blocked?: boolean;
  expired?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStep: "login" | "location" | "otp" | "complete";
  pendingPhone: string;
  setUser: (user: AuthUser | null) => void;
  setAuthStep: (step: "login" | "location" | "otp" | "complete") => void;
  setPendingPhone: (phone: string) => void;
  login: (
    fullName: string,
    phoneNumber: string,
    honeypot?: string,
  ) => Promise<void>;
  verifyOTP: (code: string, inputDurationMs?: number) => Promise<OTPResult>;
  resendOTP: () => Promise<OTPResult>;
  sendOTPAndProceed: () => Promise<OTPResult>;
  otpSentAt: number;
  setLocationGranted: (coords?: {
    lat: number;
    lng: number;
    province: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = "@taryaq_auth";

// Firebase Web SDK — يشتغل على الويب فقط
let firebaseAuth: any = null;
let signInWithPhoneNumberFn: any = null;
let RecaptchaVerifierClass: any = null;

if (Platform.OS === "web") {
  const { auth } = require("@/lib/firebase");
  const mod = require("firebase/auth");
  firebaseAuth = auth;
  signInWithPhoneNumberFn = mod.signInWithPhoneNumber;
  RecaptchaVerifierClass = mod.RecaptchaVerifier;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authStep, setAuthStep] = useState<
    "login" | "location" | "otp" | "complete"
  >("login");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [pendingHoneypot, setPendingHoneypot] = useState("");
  const [pendingLocation, setPendingLocation] = useState<
    { lat: number; lng: number; province: string } | undefined
  >();
  const [otpSentAt, setOtpSentAt] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        const tokens = await getStoredTokens();
        const tokensValid = !!tokens && tokens.refreshExpiresAt > Date.now();
        if (parsed.isVerified && !tokensValid) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          await clearTokens();
        } else {
          setUser(parsed);
          if (parsed.role && parsed.isVerified && parsed.locationGranted) {
            setAuthStep("complete");
          }
        }
      }
    } catch (error) {
      logger.error("Failed to load auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuthState = async (authUser: AuthUser | null) => {
    try {
      if (authUser) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      } else {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (error) {
      logger.error("Failed to save auth state:", error);
    }
  };

  const sendOTP = async (
    fullName: string,
    phoneNumber: string,
    location?: { lat: number; lng: number; province: string },
  ): Promise<OTPResult> => {
    try {
      // تحقق من الـ backend أولاً — rate limiting + validation
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/auth/register-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber,
          fullName,
          location,
          honeypot: pendingHoneypot,
        }),
      });

      const data = (await res.json()) as {
        message?: string;
        success?: boolean;
        sentAt?: number;
      };

      if (!res.ok) {
        return {
          success: false,
          message: data.message || "فشل إرسال رمز التحقق",
          blocked: res.status === 429,
        };
      }

      if (Platform.OS === "web") {
        // على الويب — Firebase SMS مباشرة
        const internationalPhone = "+964" + phoneNumber.slice(1);

        // نظف الـ reCAPTCHA القديم قبل إنشاء واحد جديد
        const container = document.getElementById("recaptcha-container");
        if (container) container.innerHTML = "";

        const recaptchaVerifier = new RecaptchaVerifierClass(
          firebaseAuth,
          "recaptcha-container",
          { size: "normal" },
        );
        const result = await signInWithPhoneNumberFn(
          firebaseAuth,
          internationalPhone,
          recaptchaVerifier,
        );
        setConfirmationResult(result);
      }

      if (data.sentAt) setOtpSentAt(data.sentAt);
      else setOtpSentAt(Date.now());

      return { success: true };
    } catch (e: any) {
      logger.error("[AuthContext] sendOTP error:", e);
      if (e.code === "auth/too-many-requests") {
        return {
          success: false,
          message: "تم تجاوز الحد المسموح، حاول لاحقاً",
          blocked: true,
        };
      }
      if (e.code === "auth/invalid-phone-number") {
        return { success: false, message: "رقم الهاتف غير صحيح" };
      }
      return { success: false, message: "فشل إرسال رمز التحقق" };
    }
  };

  const login = async (
    fullName: string,
    phoneNumber: string,
    honeypot: string = "",
  ) => {
    const cleanPhone = phoneNumber.replace(/\D/g, "").slice(0, 11);
    const cleanName = fullName
      .replace(/[<>"'`;{}()$\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
    setPendingPhone(cleanPhone);
    setPendingName(cleanName);
    setPendingHoneypot(honeypot);
    const newUser: AuthUser = {
      fullName: cleanName,
      phoneNumber: cleanPhone,
      role: null,
      locationGranted: false,
      isVerified: false,
    };
    setUser(newUser);
    await saveAuthState(newUser);
    setAuthStep("location");
  };

  const setLocationGranted = async (coords?: {
    lat: number;
    lng: number;
    province: string;
  }) => {
    setPendingLocation(coords);
    setUser((currentUser) => {
      if (currentUser) {
        const updatedUser = { ...currentUser, locationGranted: true };
        saveAuthState(updatedUser);
        return updatedUser;
      }
      return currentUser;
    });
    setTimeout(async () => {
      try {
        await sendOTP(pendingName, pendingPhone, coords);
      } catch (e) {
        logger.error("[AuthContext] sendOTP failed:", e);
      }
      setAuthStep("otp");
    }, 50);
  };

  const sendOTPAndProceed = async (): Promise<OTPResult> => {
    const result = await sendOTP(pendingName, pendingPhone, pendingLocation);
    if (result.success) {
      setTimeout(() => setAuthStep("otp"), 50);
    }
    return result;
  };

  const fetchUserRole = async (phoneNumber: string): Promise<UserRole> => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/role/${phoneNumber}`);
      if (response.ok) {
        const data = (await response.json()) as { role?: UserRole };
        return data.role || "patient";
      }
    } catch {
      logger.log("[AuthContext] Could not fetch role");
    }
    return "patient";
  };

  const finalizeLogin = async (phoneNumber: string) => {
    const role = await fetchUserRole(phoneNumber);
    try {
      const fbUser = await saveUserToFirebase({
        phone: phoneNumber,
        name: user?.fullName || pendingName,
      });
      setUser((currentUser) => {
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            id: fbUser.id,
            isVerified: true,
            role,
          };
          saveAuthState(updatedUser);
          return updatedUser;
        }
        return currentUser;
      });
    } catch (e) {
      logger.error("[AuthContext] Failed to save user to Firebase:", e);
      setUser((currentUser) => {
        if (currentUser) {
          const updatedUser = { ...currentUser, isVerified: true, role };
          saveAuthState(updatedUser);
          return updatedUser;
        }
        return currentUser;
      });
    }
    setAuthStep("complete");
  };

  const verifyOTP = async (
    code: string,
    inputDurationMs: number = 9999,
  ): Promise<OTPResult> => {
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return { success: false, message: "الرمز يجب أن يكون 6 أرقام" };
    }

    const phoneNumber = user?.phoneNumber || pendingPhone;

    if (Platform.OS === "web") {
      if (!confirmationResult) {
        return { success: false, message: "انتهت الجلسة، أعد إرسال الرمز" };
      }
      try {
        const userCredential = await confirmationResult.confirm(cleanCode);
        const idToken = await userCredential.user.getIdToken();
        const apiUrl = getApiUrl();

        const res = await fetch(`${apiUrl}/api/auth/verify-firebase-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            phoneNumber,
            inputDurationMs,
            honeypot: pendingHoneypot,
          }),
        });

        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          attemptsRemaining?: number;
          accessToken?: string;
          refreshToken?: string;
          accessExpiresAt?: number;
          refreshExpiresAt?: number;
        };

        if (!res.ok || !data.success) {
          return {
            success: false,
            message: data.message,
            attemptsRemaining: data.attemptsRemaining,
            blocked: res.status === 429,
            expired: data.message?.includes("انتهت الصلاحية"),
          };
        }

        if (
          data.accessToken &&
          data.refreshToken &&
          data.accessExpiresAt &&
          data.refreshExpiresAt
        ) {
          await saveTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            accessExpiresAt: data.accessExpiresAt,
            refreshExpiresAt: data.refreshExpiresAt,
          });
        }

        await finalizeLogin(phoneNumber);
        return { success: true };
      } catch (e: any) {
        logger.error("[AuthContext] Firebase verifyOTP error:", e);
        if (e.code === "auth/invalid-verification-code") {
          return { success: false, message: "رمز التحقق غير صحيح" };
        }
        if (e.code === "auth/code-expired") {
          return {
            success: false,
            message: "انتهت صلاحية الرمز",
            expired: true,
          };
        }
        return { success: false, message: "حدث خطأ — تحقق من اتصالك" };
      }
    }

    // على الجوال مؤقتاً — سيتغير عند بناء APK
    return { success: false, message: "يرجى استخدام الويب للاختبار الآن" };
  };

  const resendOTP = async (): Promise<OTPResult> => {
    const phoneNumber = user?.phoneNumber || pendingPhone;
    const fullName = user?.fullName || pendingName;
    if (!phoneNumber)
      return { success: false, message: "رقم الهاتف غير موجود" };
    return sendOTP(fullName, phoneNumber, pendingLocation);
  };

  const logout = async () => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        await fetch(`${getApiUrl()}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    setUser(null);
    setAuthStep("login");
    setPendingPhone("");
    setPendingName("");
    setPendingHoneypot("");
    setPendingLocation(undefined);
    setOtpSentAt(0);
    setConfirmationResult(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    await clearTokens();
  };

  const isAuthenticated =
    user !== null &&
    user.isVerified &&
    user.locationGranted &&
    user.role !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        authStep,
        pendingPhone,
        setUser,
        setAuthStep,
        setPendingPhone,
        login,
        verifyOTP,
        resendOTP,
        sendOTPAndProceed,
        setLocationGranted,
        logout,
        otpSentAt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
