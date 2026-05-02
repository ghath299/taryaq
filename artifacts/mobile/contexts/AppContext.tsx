import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";

interface AppContextType {
  language: "ar";
  isLoading: boolean;
  t: (key: string) => string;
}

const translations: Record<string, string> = {
  appName: "ترياق",
  home: "الرئيسية",
  doctors: "الأطباء",
  medicines: "العلاجات",
  pharmacies: "الصيدليات",
  profile: "الملف الشخصي",
  settings: "الإعدادات",
  darkMode: "الوضع الليلي",
  lightMode: "الوضع النهاري",
  systemMode: "تلقائي",
  about: "حول التطبيق",
  privacy: "سياسة الخصوصية",
  logout: "تسجيل الخروج",
  login: "تسجيل الدخول",
  register: "إنشاء حساب",
  myBookings: "حجوزاتي",
  myOrders: "طلباتي",
  search: "بحث",
  searchDoctorName: "البحث باسم الطبيب",
  selectSpecialty: "اختر التخصص",
  selectProvince: "اختر المحافظة",
  distance: "المسافة",
  book: "حجز",
  delivery: "توصيل",
  pickUp: "استلام",
  fullName: "الاسم الثلاثي",
  phone: "رقم الهاتف",
  age: "العمر",
  notes: "ملاحظات",
  submit: "إرسال",
  cancel: "إلغاء",
  aiSearch: "البحث بالذكاء الاصطناعي",
  textSearch: "البحث النصي",
  uploadImage: "رفع صورة",
  camera: "الكاميرا",
  gallery: "المعرض",
  chooseSource: "اختر مصدر الصورة",
  permissionRequired: "مطلوب إذن",
  medicineName: "اسم العلاج",
  company: "الشركة",
  usage: "الاستخدام",
  available: "متوفر",
  unavailable: "غير متوفر",
  loading: "جاري التحميل...",
  error: "حدث خطأ",
  retry: "إعادة المحاولة",
  clinic: "العيادة",
  workingHours: "ساعات العمل",
  viewAll: "عرض الكل",
  promotedDoctors: "أطباء مميزون",
  promotedPharmacies: "صيدليات مميزة",
  promotedMedicines: "علاجات مميزة",
  healthTips: "نصائح صحية",
  announcements: "إعلانات",
  apply: "تطبيق",
  clear: "مسح",
  map: "الخريطة",
  info: "المعلومات",
  photos: "الصور",
  bookAppointment: "حجز موعد",
  orderMedicine: "طلب دواء",
  menu: "القائمة",
  careerJoinTitle: "التقديم المهني",
  joinAsDoctor: "انضم كطبيب",
  joinAsPharmacist: "انضم كصيدلاني",
  km: "كم",
  emptyDoctors: "لا يوجد أطباء",
  emptyPharmacies: "لا يوجد صيدليات",
  emptyMedicines: "لا يوجد علاجات",
  emptyBookings: "لا يوجد حجوزات",
  emptyOrders: "لا يوجد طلبات",
  noResults: "لا توجد نتائج مطابقة",
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    setIsLoading(false);
  }, []);

  const t = (key: string): string => {
    return translations[key] ?? key;
  };

  return (
    <AppContext.Provider value={{ language: "ar", isLoading, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
