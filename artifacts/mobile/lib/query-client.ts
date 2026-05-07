export function getApiUrl(): string {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return window.location.origin;
  }
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  return "http://localhost:80";
}
