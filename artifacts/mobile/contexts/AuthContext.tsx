import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Alert } from "react-native";
import { getApiUrl } from "@/lib/query-client";
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
  profileComplete?: boolean;
}

interface OTPResult {
  success: boolean;
  message?: string;
  attemptsRemaining?: number;
  blocked?: boolean;
  expired?: boolean;
  needsProfile?: boolean;
}

interface PgUser {
  id: string;
  phone: string;
  fullName: string | null;
  profileImageUrl: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStep: "login" | "location" | "otp" | "complete-profile" | "complete";
  pendingPhone: string;
  setUser: (user: AuthUser | null) => void;
  setAuthStep: (step: "login" | "location" | "otp" | "complete-profile" | "complete") => void;
  setPendingPhone: (phone: string) => void;
  login: (fullName: string, phoneNumber: string, honeypot?: string) => Promise<void>;
  verifyOTP: (code: string, inputDurationMs?: number) => Promise<OTPResult>;
  resendOTP: () => Promise<OTPResult>;
  sendOTPAndProceed: () => Promise<OTPResult>;
  otpSentAt: number;
  setLocationGranted: (coords?: { lat: number; lng: number; province: string }) => Promise<void>;
  completeProfile: (name: string) => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AUTH_STORAGE_KEY = "@taryaq_auth";

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

function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("964")) return "+" + digits;
  if (digits.startsWith("0")) return "+964" + digits.slice(1);
  return "+964" + digits;
}

function clearRecaptcha() {
  const w = window as any;
  try {
    if (w.recaptchaVerifier?.clear) {
      w.recaptchaVerifier.clear();
    }
  } catch {}
  w.recaptchaVerifier = null;
  const container = document.getElementById("recaptcha-container");
  if (container) container.innerHTML = "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authStep, setAuthStep] = useState<"login" | "location" | "otp" | "complete-profile" | "complete">("login");
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

  const refreshUserFromApi = async (cachedUser: AuthUser): Promise<void> => {
    if (!cachedUser.phoneNumber) return;
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/users/me/${cachedUser.phoneNumber}`);
      if (!res.ok) return;
      const pgUser = (await res.json()) as PgUser;
      const fresh: AuthUser = {
        ...cachedUser,
        id: pgUser.id,
        fullName: pgUser.fullName ?? cachedUser.fullName,
        avatarUri: pgUser.profileImageUrl ?? undefined,
        role: (pgUser.role as UserRole) || cachedUser.role,
        profileComplete: true,
      };
      setUser(fresh);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fresh));
    } catch (e) {
      logger.error("[AuthContext] refreshUserFromApi failed:", e);
    }
  };

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
          // عرض Cache فوراً لتجنب الوميض
          setUser(parsed);
          if (parsed.isVerified && parsed.profileComplete === false) {
            setAuthStep("complete-profile");
          } else if (parsed.role && parsed.isVerified && parsed.locationGranted) {
            setAuthStep("complete");
          }
          // جلب البيانات الحقيقية من PostgreSQL في الخلفية
          if (parsed.isVerified && parsed.phoneNumber && tokensValid) {
            void refreshUserFromApi(parsed);
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

  const waitForRecaptchaContainer = (): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        if (document.getElementById("recaptcha-container")) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  };

  const sendOTP = async (
    fullName: string,
    phoneNumber: string,
    location?: { lat: number; lng: number; province: string },
  ): Promise<OTPResult> => {
    try {
      const apiUrl = getApiUrl();
      const isLocalDev = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

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
        const formattedPhone = formatToE164(phoneNumber);

        await waitForRecaptchaContainer();

        const w = window as any;

        if (!w.recaptchaVerifier) {
          w.recaptchaVerifier = new RecaptchaVerifierClass(
            firebaseAuth,
            "recaptcha-container",
            {
              size: "normal",
              callback: () => {},
              "expired-callback": () => {
                clearRecaptcha();
              },
            },
          );
          await w.recaptchaVerifier.render();
        }

        const appVerifier = w.recaptchaVerifier;
        try {
          const result = await signInWithPhoneNumberFn(
            firebaseAuth,
            formattedPhone,
            appVerifier,
          );
          setConfirmationResult(result);
        } catch (firebaseErr: any) {
          if (isLocalDev) {
            logger.warn("[AuthContext] Firebase Phone Auth failed in local dev, falling back to mock OTP:", firebaseErr);
            alert("تنبيه التطوير المحلي: تم تفعيل محاكاة الرمز تلقائياً لأن خدمات Firebase غير مهيأة محلياً.\n\nالرمز هو: 123456");
          } else {
            throw firebaseErr;
          }
        }
      } else {
        // Native mobile simulation alert
        Alert.alert(
          "تنشيط الرمز محلياً",
          "تم إرسال رمز التحقق للمحاكاة بنجاح.\nالرمز هو: 123456",
          [{ text: "حسناً" }]
        );
      }

      if (data.sentAt) setOtpSentAt(data.sentAt);
      else setOtpSentAt(Date.now());

      return { success: true };
    } catch (e: any) {
      logger.error("[AuthContext] sendOTP error:", e);
      if (e.code === "auth/invalid-app-credential") {
        return { success: false, message: "مشكلة في اعتماد التطبيق أو reCAPTCHA." };
      }
      if (e.code === "auth/captcha-check-failed") {
        if (Platform.OS === "web") clearRecaptcha();
        return { success: false, message: "فشل التحقق، أعد المحاولة." };
      }
      if (e.code === "auth/too-many-requests") {
        return { success: false, message: "محاولات كثيرة، انتظر قليلاً.", blocked: true };
      }
      if (e.code === "auth/invalid-phone-number") {
        return { success: false, message: "رقم الهاتف غير صحيح." };
      }
      return { success: false, message: "فشل إرسال رمز التحقق" };
    }
  };

  const login = async (fullName: string, phoneNumber: string, honeypot: string = "") => {
    let cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.startsWith("964")) {
      cleanPhone = "0" + cleanPhone.slice(3);
    }
    const finalPhone = cleanPhone.slice(0, 11);
    
    const cleanName = fullName
      .replace(/[<>"'`;{}()$\\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
      
    setPendingPhone(finalPhone);
    setPendingName(cleanName);
    setPendingHoneypot(honeypot);
    
    const newUser: AuthUser = {
      fullName: cleanName,
      phoneNumber: finalPhone,
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
    setTimeout(() => {
      setAuthStep("otp");
    }, 500);
  };

  const sendOTPAndProceed = async (): Promise<OTPResult> => {
    const result = await sendOTP(pendingName, pendingPhone, pendingLocation);
    if (result.success) {
      setTimeout(() => setAuthStep("otp"), 500);
    }
    return result;
  };

  const finalizeLogin = async (
    phoneNumber: string,
    isNewUser: boolean,
    pgUser: PgUser | null,
  ): Promise<boolean> => {
    if (!isNewUser && pgUser) {
      setUser((currentUser) => {
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            id: pgUser.id,
            isVerified: true,
            role: (pgUser.role as UserRole) || "patient",
            fullName: pgUser.fullName || currentUser.fullName,
            profileComplete: true,
            avatarUri: pgUser.profileImageUrl ?? undefined,
          };
          saveAuthState(updatedUser);
          return updatedUser;
        }
        return currentUser;
      });
      setAuthStep("complete");
      return false;
    } else {
      setUser((currentUser) => {
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            isVerified: true,
            role: "patient" as UserRole,
            profileComplete: false,
          };
          saveAuthState(updatedUser);
          return updatedUser;
        }
        return currentUser;
      });
      setAuthStep("complete-profile");
      return true;
    }
  };

  const verifyOTP = async (code: string, inputDurationMs: number = 9999): Promise<OTPResult> => {
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return { success: false, message: "الرمز يجب أن يكون 6 أرقام" };
    }

    const phoneNumber = user?.phoneNumber || pendingPhone;
    const isLocalDev = getApiUrl().includes("localhost") || getApiUrl().includes("127.0.0.1");

    if (isLocalDev && cleanCode === "123456") {
      // Local mock verification for both Web and Mobile local development
      const needsProfile = await finalizeLogin(phoneNumber, true, null);
      return { success: true, needsProfile };
    }

    if (Platform.OS !== "web") {
      // Local mock verification fallback for native mobile platforms
      if (cleanCode === "123456") {
        const needsProfile = await finalizeLogin(phoneNumber, true, null);
        return { success: true, needsProfile };
      } else {
        return { success: false, message: "الرمز غير صحيح (استخدم 123456 للطلب المحلي)" };
      }
    }

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
          isNewUser?: boolean;
          user?: PgUser | null;
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

        const needsProfile = await finalizeLogin(
          phoneNumber,
          data.isNewUser ?? true,
          data.user ?? null,
        );
        return { success: true, needsProfile };
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

    return { success: false, message: "حدث خطأ غير متوقع" };
  };

  const completeProfile = async (name: string): Promise<void> => {
    const phoneNumber = user?.phoneNumber || pendingPhone;
    try {
      const apiUrl = getApiUrl();
      const token = await getValidAccessToken();
      const res = await fetch(`${apiUrl}/api/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: phoneNumber, fullName: name }),
      });
      if (res.ok) {
        const pgUser = (await res.json()) as PgUser;
        setUser((currentUser) => {
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              id: pgUser.id,
              fullName: pgUser.fullName || name,
              profileComplete: true,
              role: (pgUser.role as UserRole) || "patient",
            };
            saveAuthState(updatedUser);
            return updatedUser;
          }
          return currentUser;
        });
        setAuthStep("complete");
        return;
      }
      logger.error("[AuthContext] completeProfile API returned:", res.status);
    } catch (e) {
      logger.error("[AuthContext] completeProfile API failed:", e);
    }
    setUser((currentUser) => {
      if (currentUser) {
        const updatedUser = { ...currentUser, fullName: name, profileComplete: true };
        saveAuthState(updatedUser);
        return updatedUser;
      }
      return currentUser;
    });
    setAuthStep("complete");
  };

  const updateUser = async (updates: Partial<AuthUser>): Promise<void> => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      const updatedUser = { ...currentUser, ...updates };
      saveAuthState(updatedUser);
      return updatedUser;
    });
  };

  const resendOTP = async (): Promise<OTPResult> => {
    const phoneNumber = user?.phoneNumber || pendingPhone;
    const fullName = user?.fullName || pendingName;
    if (!phoneNumber) return { success: false, message: "رقم الهاتف غير موجود" };
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
    user.role !== null &&
    user.profileComplete !== false;

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
        completeProfile,
        updateUser,
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
