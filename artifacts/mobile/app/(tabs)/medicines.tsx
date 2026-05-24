// ملاحظة: هذا route وسيط (intermediate route).
// الـ Bottom Tab Bar يتجاوزه ويتنقل مباشرة إلى medicine-search.
// الـ active state مربوط بـ "medicine-search" وليس "medicines".
// لا تحذف هذا الملف لأن Expo Router يحتاجه لتسجيل route الاسم "medicines" داخل (tabs).
import { Redirect } from "expo-router";

export default function MedicinesTab() {
  return <Redirect href="/medicine-search" />;
}
