import { Capacitor } from "@capacitor/core";

const CUSTOM_API_URL_KEY = "svcet_custom_api_url";

// Default host machine LAN IP discovered on the current network interface
export const LOCAL_LAN_API_FALLBACK = "http://10.251.138.130:4000";

// Default production Render cloud backend endpoint
export const DEFAULT_PRODUCTION_API_URL = "https://svcet-bus-tracker-2.onrender.com";

export interface ApiConfigInfo {
  url: string;
  source: "custom" | "env" | "browser_host" | "lan_fallback" | "cloud_production" | "dev_localhost";
  isNative: boolean;
  isHttps: boolean;
  isLocalhost: boolean;
  warning?: string;
}

/**
 * Validate a candidate API URL.
 */
export function validateApiUrl(candidate: string): { valid: boolean; error?: string } {
  if (!candidate || !candidate.trim()) {
    return { valid: false, error: "API URL cannot be empty." };
  }

  const clean = candidate.trim().replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return {
      valid: false,
      error: "Invalid URL format. Must include protocol (e.g. https://your-domain.com or http://10.x.x.x:4000).",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Protocol must be http:// or https://." };
  }

  return { valid: true };
}

/**
 * Resolve the centralized API Base URL with strict validation:
 * 1. User-customized runtime URL in localStorage
 * 2. Environment variable VITE_API_BASE_URL
 * 3. In Web browser, if on HTTPS, connect to production HTTPS cloud API
 * 4. In native Android APK (Capacitor), do NOT fall back to localhost (points to phone),
 *    fall back to development LAN IP or prompt the user.
 * 5. In local web development, allow http://localhost:4000
 */
export function getApiBaseUrl(): string {
  // 1. Runtime user-configured override
  try {
    const custom = localStorage.getItem(CUSTOM_API_URL_KEY);
    if (custom && custom.trim()) {
      const { valid } = validateApiUrl(custom.trim());
      if (valid) {
        return custom.trim().replace(/\/+$/, "");
      }
    }
  } catch {
    // Ignore storage read errors
  }

  // 2. Build-time environment variable
  const envUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  const isNative = Capacitor.isNativePlatform();

  if (envUrl) {
    const isEnvLocalhost = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");

    // If running inside native Android APK and envUrl was left as localhost,
    // localhost will resolve to the phone's loopback and fail.
    if (isNative && isEnvLocalhost) {
      console.warn(
        `[API Config] Native Android device detected with localhost env URL (${envUrl}). Falling back to LAN API: ${LOCAL_LAN_API_FALLBACK}`,
      );
      return LOCAL_LAN_API_FALLBACK;
    }

    return envUrl;
  }

  // 3. Browser runtime environment check
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;

    // If browser is accessed via HTTPS (e.g., deployed to Vercel/Render/Custom Domain),
    // NEVER fall back to HTTP (Mixed Content failure). Default to Production Cloud API.
    if (protocol === "https:") {
      return DEFAULT_PRODUCTION_API_URL;
    }

    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:4000`;
    }
  }

  // 4. Native Android APK fallback
  if (isNative) {
    return LOCAL_LAN_API_FALLBACK;
  }

  // 5. Local development web fallback
  return "http://localhost:4000";
}

/**
 * Get comprehensive metadata about the current API configuration.
 */
export function getApiConfigInfo(): ApiConfigInfo {
  const url = getApiBaseUrl();
  const isNative = Capacitor.isNativePlatform();
  const isHttps = url.startsWith("https://");
  const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");

  let source: ApiConfigInfo["source"] = "dev_localhost";
  try {
    const custom = localStorage.getItem(CUSTOM_API_URL_KEY);
    if (custom && custom.trim() && custom.trim() === url) {
      source = "custom";
    }
  } catch {}

  if (source !== "custom") {
    const envUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
    if (envUrl && url === envUrl) {
      source = "env";
    } else if (url === DEFAULT_PRODUCTION_API_URL) {
      source = "cloud_production";
    } else if (url === LOCAL_LAN_API_FALLBACK) {
      source = "lan_fallback";
    } else if (typeof window !== "undefined" && url.includes(window.location.hostname)) {
      source = "browser_host";
    }
  }

  let warning: string | undefined;
  if (isNative && isLocalhost) {
    warning = "On a mobile device, localhost refers to the phone. API calls will fail unless pointing to a cloud or LAN server.";
  } else if (!isHttps && !isLocalhost && !url.includes("10.") && !url.includes("192.168.")) {
    warning = "In production, an HTTPS URL is strongly recommended for security and Geolocation API support.";
  }

  return {
    url,
    source,
    isNative,
    isHttps,
    isLocalhost,
    warning,
  };
}

/**
 * Save a custom API Base URL to localStorage and notify listeners.
 */
export function setCustomApiBaseUrl(newUrl: string): { success: boolean; error?: string } {
  const { valid, error } = validateApiUrl(newUrl);
  if (!valid) {
    return { success: false, error };
  }

  const clean = newUrl.trim().replace(/\/+$/, "");
  try {
    localStorage.setItem(CUSTOM_API_URL_KEY, clean);
    window.dispatchEvent(new CustomEvent("svcet:api_url_changed", { detail: { url: clean } }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save URL to local storage." };
  }
}

/**
 * Clear custom runtime URL and reset to default.
 */
export function resetCustomApiBaseUrl(): void {
  try {
    localStorage.removeItem(CUSTOM_API_URL_KEY);
    const def = getApiBaseUrl();
    window.dispatchEvent(new CustomEvent("svcet:api_url_changed", { detail: { url: def } }));
  } catch {
    // Ignore storage removal errors
  }
}
