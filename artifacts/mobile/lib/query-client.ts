export function getApiUrl(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }
    return window.location.origin;
  }
  
  return "http://localhost:5000";
}
