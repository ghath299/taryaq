import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import * as ImageManipulator from "expo-image-manipulator";
import { storage } from "./firebase";

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  return result.uri;
}

export async function uploadAvatar(
  userId: string,
  localUri: string,
): Promise<string> {
  const compressedUri = await compressImage(localUri);

  const response = await fetch(compressedUri);
  const blob = await response.blob();

  const timestamp = Date.now();
  const storagePath = `avatars/${userId}/${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

export function extractStoragePath(downloadUrl: string): string | null {
  try {
    const u = new URL(downloadUrl);
    const parts = u.pathname.split("/o/");
    if (parts.length < 2) return null;
    return decodeURIComponent(parts[1]);
  } catch {
    return null;
  }
}

export async function deleteAvatar(downloadUrl: string): Promise<void> {
  try {
    const path = extractStoragePath(downloadUrl);
    if (!path) return;
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch {
    // ignore — old file may not exist
  }
}
