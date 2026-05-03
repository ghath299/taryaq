import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await AsyncStorage.setItem(`secure:${key}`, value);
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (isNative) {
    return await SecureStore.getItemAsync(key);
  }
  return await AsyncStorage.getItem(`secure:${key}`);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isNative) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(`secure:${key}`);
  }
}
