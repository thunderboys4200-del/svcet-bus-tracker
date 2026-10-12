import type { Location, Stop } from "../types";

/**
 * Calculates haversine distance in kilometers between two GPS coordinates.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface EtaResult {
  nextStopName: string | null;
  nextStopDistanceKm: number | null;
  estimatedMinutes: number | null;
  label: string;
  isStale: boolean;
  confidence: "reliable" | "estimated" | "unavailable";
}

/**
 * Calculates realistic transit ETA to stops along the route.
 * Takes average campus/urban transit speed (approx. 22-25 km/h factoring in turns and stops).
 * Accounts for stale locations (>3 minutes without updates).
 */
export function calculateRouteEta(
  currentLocation?: Location | null,
  stops?: Stop[] | null,
  isLive = false,
): EtaResult {
  if (!currentLocation || !stops || stops.length === 0) {
    return {
      nextStopName: null,
      nextStopDistanceKm: null,
      estimatedMinutes: null,
      label: "ETA unavailable — bus not currently active",
      isStale: true,
      confidence: "unavailable",
    };
  }

  // Check location freshness
  const recTime = currentLocation.recordedAt
    ? new Date(currentLocation.recordedAt).getTime()
    : NaN;
  const ageMs = !Number.isNaN(recTime) ? Date.now() - recTime : Infinity;
  const isStale = !isLive || ageMs > 180_000;

  if (isStale) {
    return {
      nextStopName: null,
      nextStopDistanceKm: null,
      estimatedMinutes: null,
      label: "ETA paused — GPS signal is stale or awaiting updates",
      isStale: true,
      confidence: "unavailable",
    };
  }

  // Find closest upcoming stop along the sequence
  let nearestStop: Stop | null = null;
  let minDistance = Infinity;

  for (const stop of stops) {
    if (
      typeof stop.latitude === "number" &&
      typeof stop.longitude === "number"
    ) {
      const dist = calculateDistanceKm(
        currentLocation.latitude,
        currentLocation.longitude,
        stop.latitude,
        stop.longitude,
      );

      // We look for nearest stop with reasonable proximity
      if (dist < minDistance) {
        minDistance = dist;
        nearestStop = stop;
      }
    }
  }

  if (!nearestStop || minDistance === Infinity) {
    return {
      nextStopName: null,
      nextStopDistanceKm: null,
      estimatedMinutes: null,
      label: "ETA unavailable for current stops",
      isStale: false,
      confidence: "unavailable",
    };
  }

  // Road curvature / urban traffic multiplier (typically 1.3x - 1.4x straight line)
  const roadDistanceKm = minDistance * 1.35;

  // Average bus speed in campus/suburban road is approx 24 km/h (0.4 km/min)
  // Plus 1 minute dwell time per stop
  const avgSpeedKmh = 24;
  const transitTimeMinutes = Math.round((roadDistanceKm / avgSpeedKmh) * 60) + 1;

  if (minDistance < 0.1) {
    return {
      nextStopName: nearestStop.name,
      nextStopDistanceKm: parseFloat(minDistance.toFixed(2)),
      estimatedMinutes: 0,
      label: `Arriving now at ${nearestStop.name}`,
      isStale: false,
      confidence: "reliable",
    };
  }

  return {
    nextStopName: nearestStop.name,
    nextStopDistanceKm: parseFloat(roadDistanceKm.toFixed(2)),
    estimatedMinutes: Math.max(1, transitTimeMinutes),
    label: `~${Math.max(1, transitTimeMinutes)} min to ${nearestStop.name} (${roadDistanceKm.toFixed(1)} km road est.)`,
    isStale: false,
    confidence: "estimated",
  };
}
