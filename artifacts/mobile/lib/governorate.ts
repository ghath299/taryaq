import AsyncStorage from "@react-native-async-storage/async-storage";
import { provinces } from "@/data/mockData";

export const GOVERNORATE_STORAGE_KEY = "@taryaq_governorate";

const governorateCenters: Record<string, { lat: number; lng: number }> = {
  Baghdad: { lat: 33.3152, lng: 44.3661 },
  Basra: { lat: 30.5085, lng: 47.7804 },
  Nineveh: { lat: 36.345, lng: 43.1575 },
  Erbil: { lat: 36.1911, lng: 44.0092 },
  Najaf: { lat: 31.9956, lng: 44.3148 },
  Karbala: { lat: 32.6078, lng: 44.0249 },
  "Dhi Qar": { lat: 31.0453, lng: 46.2573 },
  Anbar: { lat: 33.425, lng: 43.299 },
  Diyala: { lat: 33.7436, lng: 44.617 },
  Kirkuk: { lat: 35.4681, lng: 44.3922 },
};

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getClosestGovernorateFromCoords = (latitude: number, longitude: number) => {
  let closest = "Baghdad";
  let closestDistance = Number.POSITIVE_INFINITY;
  Object.entries(governorateCenters).forEach(([name, center]) => {
    const dist = distanceInKm(latitude, longitude, center.lat, center.lng);
    if (dist < closestDistance) {
      closestDistance = dist;
      closest = name;
    }
  });
  return closest;
};

export const normalizeGovernorate = (name?: string | null) => {
  if (!name) return null;
  const value = name.trim().toLowerCase();
  const province = provinces.find(
    (item) => item.nameEn.toLowerCase() === value || item.nameAr.toLowerCase() === value
  );
  return province?.nameEn ?? null;
};

export const saveGovernorate = async (nameEn: string) => {
  await AsyncStorage.setItem(GOVERNORATE_STORAGE_KEY, nameEn);
};

export const loadGovernorate = async () => {
  return AsyncStorage.getItem(GOVERNORATE_STORAGE_KEY);
};
