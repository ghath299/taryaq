# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run dev` — run API server locally

---

## ترياق — Arabic Patient Health App

### Architecture

**Mobile App** (`artifacts/mobile`) — React Native / Expo Router

- RTL Arabic layout enforced via `I18nManager.forceRTL(true)` in `AppContext`
- Font: Tajawal (400Regular, 500Medium, 700Bold, 800ExtraBold) from `@expo-google-fonts/tajawal`
- Theme: primary `#5EDFFF`, primaryDark `#1F6AE1`, backgroundRoot `#F2F2F7` / dark `#0D1117`
- Firebase Realtime Database: project `ghath-c86ae`, databaseURL `https://ghath-c86ae-default-rtdb.firebaseio.com`
- OTP auth via API server (`/api/auth/send-otp`, `/api/auth/verify-otp`) with Telegram delivery
- Push notifications via `expo-notifications`
- Animations: `react-native-reanimated` (FadeIn, FadeInUp, FadeInDown, springs, shakes)

**API Server** (`artifacts/api-server`) — Express 5, port 8080

- `POST /api/auth/send-otp` — generates 6-digit OTP, sends via Telegram (or logs to console in dev)
- `POST /api/auth/verify-otp` — validates OTP with expiry + attempt limits
- `GET /api/users/role/:phone` — returns user role (patient/doctor/pharmacist)
- `GET /api/healthz` — health check
- `TELEGRAM_BOT_TOKEN` env var required for real delivery; falls back to console logging
- **Master test credentials** (single bypass phone for QA):
  - phone `07700000000` + OTP `123456` skips Telegram and rate limit
  - Override via env vars `MASTER_PHONE` and `MASTER_OTP`

### App Screens / Navigation

```
app/
  _layout.tsx            — Root: ThemeProvider, AppProvider, AuthProvider, Tajawal fonts
  index.tsx              — Redirect based on auth state
  (auth)/
    login.tsx            — Name + phone input
    location.tsx         — Location permission (then sends OTP)
    otp.tsx              — 6-digit OTP verification
  (tabs)/
    index.tsx            — Home: header (bell+badge, greeting, gradient avatar), search bar, blue→cyan hero banner with phone+stethoscope image, 4 quick services (تصوير وصفة / أقرب صيدلية / البحث عن دواء / حجز طبيب), 3 featured doctor cards with real photos, "حالتك اليوم" health metrics card, "نصيحة اليوم" tip card, floating "استشارة" FAB
    doctors.tsx          — Doctors list with search + specialty/province filters
    medicines.tsx        — Coming soon placeholder
    pharmacies.tsx       — Coming soon placeholder
  doctor/[id].tsx        — Doctor detail: info, hours, Waze navigation
  book/[doctorId].tsx    — Book appointment (saves to Firebase)
  bookings.tsx           — User's bookings from Firebase
  orders.tsx             — Orders placeholder
  notifications.tsx      — Local notifications list
  search.tsx             — Full-text search doctors/specialties
  career-join.tsx        — Join as doctor/pharmacist form
```

### Contexts & Hooks

- `contexts/AuthContext.tsx` — auth step machine (login → location → otp → complete)
- `contexts/AppContext.tsx` — RTL setup, Arabic translations
- `hooks/useTheme.ts` — ThemeProvider + useTheme (light/dark/system)
- `hooks/useNotifications.ts` — local notification storage, push setup

### Key Files

- `constants/colors.ts` — Colors, Spacing, BorderRadius, Typography, Shadows, Animation, addAlpha
- `lib/firebase.ts` — Firebase Realtime Database init
- `lib/firebase-data.ts` — saveUser, getUser, createBooking, subscribeToUserBookings, etc.
- `lib/query-client.ts` — getApiUrl() helper
- `data/mockData.ts` — doctors, specialties, provinces mock data

### Environment Variables

- `EXPO_PUBLIC_DOMAIN` — set automatically by workflow (Replit domain)
- `TELEGRAM_BOT_TOKEN` — required for real OTP delivery (optional, falls back to console)
- `SESSION_SECRET` — available (for future use)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
