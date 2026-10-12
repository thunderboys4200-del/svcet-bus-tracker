import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { Location } from "../types";

export interface TrackingOptions {
  onLocation: (location: Location) => void;
  onError: (error: { code?: number | string; message: string }) => void;
}

let wakeLockSentinel: any = null;

/**
 * Request Screen Wake Lock (prevents phone screen from dimming/sleeping during trip tracking).
 * Supported in modern mobile browsers and Android WebViews.
 */
export async function acquireWakeLock(): Promise<boolean> {
  if (typeof window !== "undefined" && "wakeLock" in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err: any) {
      console.warn("Wake lock request failed:", err?.message || err);
    }
  }
  return false;
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    } finally {
      wakeLockSentinel = null;
    }
  }
}

/**
 * Request GPS Location permissions across both Web/PWA and native Android (Capacitor).
 */
export async function checkAndRequestLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") {
        return true;
      }
      const req = await Geolocation.requestPermissions();
      return req.location === "granted" || req.coarseLocation === "granted";
    } catch (err) {
      console.error("Capacitor location permission error:", err);
      return false;
    }
  }

  // Web / PWA browser environment
  if (typeof navigator !== "undefined" && "permissions" in navigator) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return status.state === "granted" || status.state === "prompt";
    } catch {
      return true; // Fallback to prompt upon watchPosition
    }
  }

  return "geolocation" in navigator;
}

/**
 * Start high-accuracy location tracking.
 * Works seamlessly across Android Native (Capacitor Geolocation) and Mobile Web / PWA (HTML5 Geolocation).
 * Returns a cleanup unsubscribe function.
 */
export async function startLocationTracking({
  onLocation,
  onError,
}: TrackingOptions): Promise<() => void> {
  // Acquire wake lock so tracking stays active while screen is on
  void acquireWakeLock();

  if (Capacitor.isNativePlatform()) {
    try {
      // Ensure permissions before starting watch
      const hasPerm = await checkAndRequestLocationPermission();
      if (!hasPerm) {
        onError({
          code: "PERMISSION_DENIED",
          message: "Location permission was denied. Please allow location access in Android Settings.",
        });
        return () => {};
      }

      const callbackId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
        (position, err) => {
          if (err) {
            onError({
              code: err.message.includes("denied") ? "PERMISSION_DENIED" : "GPS_ERROR",
              message: err.message,
            });
            return;
          }

          if (position) {
            const heading = position.coords.heading;
            const speedKmh = position.coords.speed !== null && position.coords.speed !== undefined
              ? Math.max(0, Math.round(position.coords.speed * 3.6))
              : undefined;

            const loc: Location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || undefined,
              heading: heading !== null && heading !== undefined && !Number.isNaN(heading) ? heading : undefined,
              speed: speedKmh,
              recordedAt: new Date(position.timestamp).toISOString(),
            };

            onLocation(loc);
          }
        },
      );

      return async () => {
        void releaseWakeLock();
        try {
          await Geolocation.clearWatch({ id: callbackId });
        } catch {
          // Ignore clear watch errors
        }
      };
    } catch (err: any) {
      onError({
        code: "NATIVE_WATCH_ERROR",
        message: err?.message || "Failed to start native GPS tracking",
      });
      return () => {};
    }
  }

  // Web / PWA Geolocation fallback
  if (!("geolocation" in navigator)) {
    onError({
      code: "NOT_SUPPORTED",
      message: "Geolocation is not supported by your browser.",
    });
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const heading = pos.coords.heading;
      const speedKmh = pos.coords.speed !== null && pos.coords.speed !== undefined
        ? Math.max(0, Math.round(pos.coords.speed * 3.6))
        : undefined;

      const loc: Location = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy || undefined,
        heading: heading !== null && heading !== undefined && !Number.isNaN(heading) ? heading : undefined,
        speed: speedKmh,
        recordedAt: new Date(pos.timestamp).toISOString(),
      };

      onLocation(loc);
    },
    (err) => {
      onError({
        code: err.code === 1 ? "PERMISSION_DENIED" : err.code,
        message: err.message,
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    },
  );

  return () => {
    void releaseWakeLock();
    navigator.geolocation.clearWatch(watchId);
  };
}
