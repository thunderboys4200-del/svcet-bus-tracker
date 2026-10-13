import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import type { Location, Stop } from "../types";

// Default coordinates centered on SVCET campus (13.143, 79.908)
export const DEFAULT_CENTER: [number, number] = [13.143, 79.908];

function RecenterMap({
  position,
  triggerCenter,
}: {
  position: [number, number];
  triggerCenter: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (triggerCenter > 0) {
      map.setView(position, Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [map, position, triggerCenter]);

  return null;
}

// Custom HTML icon for route stops
function createStopIcon(sequence: number, _name?: string) {
  return L.divIcon({
    className: "custom-stop-marker",
    html: `
      <div style="
        background: #0f172a;
        color: #ffffff;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        border: 2px solid #ffffff;
        box-shadow: 0 3px 8px rgba(15, 23, 42, 0.35);
      ">${sequence}</div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// Custom HTML icon for Live Bus
function createBusIcon(busNumber: string, isLive: boolean) {
  const bgColor = isLive ? "#2563eb" : "#475569";
  const statusDot = isLive ? "#22c55e" : "#94a3b8";

  return L.divIcon({
    className: "custom-bus-marker",
    html: `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: ${bgColor};
        color: #ffffff;
        padding: 5px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.2px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.3);
        white-space: nowrap;
      ">
        <span style="
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${statusDot};
          box-shadow: 0 0 0 2px rgba(255,255,255,0.4);
        "></span>
        <span>${busNumber}</span>
      </div>
    `,
    iconSize: [84, 28],
    iconAnchor: [42, 14],
    popupAnchor: [0, -16],
  });
}

interface BusMapProps {
  location?: Location | null;
  stops?: Stop[];
  geometry?: [number, number][];
  busNumber?: string;
  isLive?: boolean;
  large?: boolean;
}

export function BusMap({
  location,
  stops = [],
  geometry = [],
  busNumber = "BUS-001",
  isLive = false,
  large = false,
}: BusMapProps) {
  const [centerTrigger, setCenterTrigger] = useState(0);

  const hasGps =
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude);

  const busPosition: [number, number] = hasGps
    ? [location.latitude, location.longitude]
    : DEFAULT_CENTER;

  // Build polyline coordinates from geometry or sequenced stops
  const polylinePositions: [number, number][] =
    geometry && geometry.length > 0
      ? geometry
      : stops
          .filter(
            (s) =>
              typeof s.latitude === "number" &&
              typeof s.longitude === "number",
          )
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
          .map((s) => [s.latitude, s.longitude]);

  return (
    <div className={`map-frame ${large ? "map-frame-large" : ""}`} style={{ position: "relative" }}>
      <MapContainer
        center={busPosition}
        zoom={14}
        scrollWheelZoom
        className="bus-map"
        style={{ width: "100%", height: "100%", borderRadius: "var(--radius-md)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap position={busPosition} triggerCenter={centerTrigger} />

        {/* Route Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.8,
              dashArray: "1, 10",
              lineJoin: "round",
            }}
          />
        )}

        {/* Route Stops */}
        {stops.map((stop, index) => {
          if (
            typeof stop.latitude !== "number" ||
            typeof stop.longitude !== "number"
          ) {
            return null;
          }

          const seq = stop.sequence || index + 1;
          return (
            <Marker
              key={`${stop.id || stop._id || stop.name}-${index}`}
              position={[stop.latitude, stop.longitude]}
              icon={createStopIcon(seq, stop.name)}
            >
              <Popup>
                <div style={{ padding: "4px 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <MapPin size={14} color="#2563eb" />
                    <strong style={{ fontSize: "13px", color: "var(--navy-900)" }}>
                      Stop {seq}: {stop.name}
                    </strong>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Live Bus Marker */}
        {hasGps && (
          <>
            {/* Accuracy ring */}
            {location.accuracy && location.accuracy > 0 && location.accuracy < 250 && (
              <CircleMarker
                center={busPosition}
                radius={Math.min(location.accuracy, 40)}
                pathOptions={{
                  color: isLive ? "#2563eb" : "#94a3b8",
                  fillColor: isLive ? "#3b82f6" : "#cbd5e1",
                  fillOpacity: 0.15,
                  weight: 1.5,
                }}
              />
            )}

            <Marker
              position={busPosition}
              icon={createBusIcon(busNumber, isLive)}
            >
              <Popup>
                <div style={{ padding: "4px 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--navy-900)" }}>{busNumber}</strong>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "var(--radius-full)",
                        backgroundColor: isLive ? "#dcfce7" : "#f1f5f9",
                        color: isLive ? "#166534" : "#64748b",
                      }}
                    >
                      {isLive ? "LIVE GPS" : "OFFLINE / IDLE"}
                    </span>
                  </div>

                  {location.speed !== undefined && (
                    <div style={{ fontSize: "12px", color: "var(--navy-800)", marginBottom: "3px" }}>
                      Speed: <strong>{location.speed} km/h</strong>
                    </div>
                  )}

                  {location.recordedAt && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      Updated: {new Date(location.recordedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Recenter Floating Button */}
      {hasGps && (
        <button
          className="button button-white"
          style={{
            position: "absolute",
            bottom: "16px",
            right: "16px",
            zIndex: 450,
            padding: "8px 14px",
            borderRadius: "var(--radius-full)",
            boxShadow: "var(--shadow-md)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
          }}
          onClick={() => setCenterTrigger((prev) => prev + 1)}
          title="Recenter Map on Bus Location"
        >
          <LocateFixed size={15} color="#2563eb" />
          <span>Center Bus</span>
        </button>
      )}

      {!hasGps && (
        <div className="map-empty">
          <span className="map-empty-icon">
            <Navigation size={22} />
          </span>
          <strong>Awaiting Live Bus Telemetry</strong>
          <span>The vehicle position marker will stream in real time when a driver starts the trip.</span>
        </div>
      )}

      <div className="map-attribution-note">
        <span className={`live-dot ${isLive ? "" : "live-badge-muted"}`} />
        <span>OpenStreetMap Live</span>
      </div>
    </div>
  );
}

export default BusMap;
