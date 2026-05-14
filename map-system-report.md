# تقرير نظام خريطة البحث عن الدواء

---

## 1. المعمارية الحالية

يتكون النظام من ثلاثة ملفات رئيسية تعمل معاً:

```
medicine-search.tsx  (الشاشة الأم)
        │
        │  props: searchRadius, isSearching, userLocation, routeCoords
        ▼
MedicineSearchMapScreen.tsx  (مكوّن الخريطة)
        │
        │  injectJavaScript ──► Leaflet داخل WebView
        ▼
pharmacy.ts  (مسارات API - غير مستخدمة في المحاكاة حالياً)
```

---

## 2. من يتحكم في ماذا؟

### دائرة نطاق البحث (Radius Circle)
**الملف:** `MedicineSearchMapScreen.tsx`

- **في Leaflet (native):** السطر 386 - `radiusCircle = L.circle([lat, lng], { radius: ${radius} })`
- يُحدَّث عبر `window.updateUser(lat, lng, radius)` بـ `injectJavaScript` (السطر 531)
- **المشكلة:** الدائرة تظهر دفعة واحدة بالحجم الكامل، لا تتوسع تدريجياً

### علامات الصيدليات (Pharmacy Markers)
**الملف:** `MedicineSearchMapScreen.tsx`

- تُبنى في `buildLeafletHtml` (السطر 395-399) من `visiblePharmacies`
- تُحدَّث حالة كل علامة عبر `window.updateStatus(id, status)` (السطر 543)
- الألوان: `waiting=أزرق`, `available=أخضر`, `unavailable=رمادي`, `timeout=فاتح`

### موقع المستخدم (User Location)
**الملف:** `medicine-search.tsx`

- يراقب GPS حياً بـ `Location.watchPositionAsync` (السطر 117)
- يُمرَّر كـ `userLocation` prop إلى `MedicineSearchMapScreen`
- يُعرض في Leaflet كـ `userMarker` (نقطة زرقاء مع هالة)

### رسم الخريطة (Map Rendering)
**الملف:** `MedicineSearchMapScreen.tsx`

- **Native (iOS/Android):** WebView + Leaflet.js (السطر 714)
- **Web:** عرض محاكي بصري بـ React Native Views (السطر 759)
- حدود محافظة كربلاء مرسومة بـ GeoJSON (السطر 347)

### تصفية الصيدليات (Pharmacy Filtering)
**الملف:** `MedicineSearchMapScreen.tsx`

```typescript
// السطر 490-496
const visiblePharmacies = useMemo(() => {
  return pharmacies.filter((p) => {
    const coord = pharmacyCoords[p.id];
    if (!coord) return false;
    return coord.realDistanceM <= searchRadius;  // ← معيار الفلترة
  });
}, [pharmacies, pharmacyCoords, searchRadius]);
```

---

## 3. المشكلات الحالية

| المشكلة | التفاصيل |
|---------|---------|
| **الدائرة ثابتة** | تظهر بكاملها دفعة واحدة، لا تتوسع بشكل متحرك |
| **الترتيب عشوائي** | الصيدليات تُرسل في ترتيب المصفوفة، ليس حسب المسافة |
| **التوقيت ثابت** | التأخير = `1000 + index * 700ms` بدلاً من أن يرتبط بتوسع الدائرة |
| **انفصال الرادار** | نبضة الرادار (React Native) منفصلة تماماً عن دائرة Leaflet |
| **لا تتدرج الاكتشافات** | كل الصيدليات تُرسل في وقت متقارب، لا يرتبط وقت إشعار كل صيدلية بمسافتها |

---

## 4. خطة التنفيذ (الأنظف والأبسط)

### الخطوة 1 — تحريك دائرة Leaflet من الداخل

أضف دالة `window.animateRadius(targetRadius, durationMs)` داخل HTML الـ Leaflet تستخدم `requestAnimationFrame` لتوسيع الدائرة سلاسة من 0 إلى `targetRadius`:

```javascript
window.animateRadius = function(target, duration) {
  var start = performance.now();
  var from = radiusCircle.getRadius() || 0;
  function step(now) {
    var t = Math.min((now - start) / duration, 1);
    // easing: ease-out
    var eased = 1 - Math.pow(1 - t, 3);
    radiusCircle.setRadius(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
};
```

### الخطوة 2 — مزامنة الرادار مع التوسع

عند بدء البحث، أطلق الأنيميشن من React Native ومن Leaflet في نفس الوقت:

```typescript
const ANIMATION_DURATION = 4000; // 4 ثوان للتوسع الكامل

// في Leaflet:
webViewRef.current?.injectJavaScript(
  `window.animateRadius(${searchRadius}, ${ANIMATION_DURATION}); true;`
);
```

### الخطوة 3 — ترتيب الصيدليات حسب المسافة

```typescript
const sortedCandidates = [...visiblePharmacies].sort(
  (a, b) => (pharmacyCoords[a.id]?.realDistanceM ?? 0) 
           - (pharmacyCoords[b.id]?.realDistanceM ?? 0)
);
```

### الخطوة 4 — ربط توقيت الاكتشاف بموقع كل صيدلية في مسار التوسع

```typescript
sortedCandidates.forEach((p) => {
  const dist = pharmacyCoords[p.id]?.realDistanceM ?? p.distanceM;
  // الصيدلية تُكتشف عندما تصل الدائرة إليها
  const detectionDelay = (dist / searchRadius) * ANIMATION_DURATION + 200;
  
  const timer = setTimeout(() => {
    if (p.isAvailable) handleFound(p.id);
    else update(p.id, "unavailable");
  }, detectionDelay);
  
  timersRef.current.push(timer);
});
```

### الخطوة 5 — إعادة تعيين الدائرة عند الإيقاف

```javascript
window.resetRadius = function() {
  radiusCircle.setRadius(0);
};
```

---

## 5. ملخص الملفات التي ستُعدَّل

| الملف | التغييرات |
|-------|----------|
| `MedicineSearchMapScreen.tsx` | إضافة `animateRadius` و`resetRadius` في HTML، ترتيب الصيدليات، ربط التوقيت بالمسافة |
| `medicine-search.tsx` | **لا تغييرات** — يعمل كما هو |
| `pharmacy.ts` | **لا تغييرات** — لا علاقة له بالمحاكاة |

---

## 6. التدفق الكامل بعد التعديل

```
المستخدم يضغط "ابدأ البحث"
        │
        ▼
isSearching = true
        │
        ├─► Leaflet: animateRadius(500m → 4000ms)  ← دائرة تتوسع سلاسة
        │
        ├─► React Native: radarPulse animation
        │
        ▼
الدائرة تمر بصيدلية (280م بعد 2240ms)
        │
        ▼
status = "waiting" → "available" / "unavailable"
        │
        ▼
Leaflet marker يتغير لونه + قائمة الصيدليات تُحدَّث
        │
        ▼
أقرب صيدلية متاحة → onPharmacyFound() → step="delivery"
```

---

*تاريخ التقرير: 2026-05-13*
