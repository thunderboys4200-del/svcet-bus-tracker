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
import { LocateFixed, MapPin } from "lucide-react";
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
        background: #1e3a8a;
        color: #ffffff;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${sequence}</div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

// Custom HTML icon for Bus
function createBusIcon(busNumber: string, isLive: boolean) {
  const color = isLive ? "#2563eb" : "#64748b";
  return L.divIcon({
    className: "custom-bus-marker",
    html: `
      <div style="
        background: ${color};
        color: white;
        padding: 5px 9px;
        border-radius: 14px;
        font-size: 11px;
        font-weight: 800;
        display: flex;
        align-items: center;
        gap: 5px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        white-space: nowrap;
      ">
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${isLive ? "#4ade80" : "#fca5a5"};"></span>
        <span>${busNumber}</span>
      </div>
    `,
    iconSize: [80, 28],
    iconAnchor: [40, 14],
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
        style={{ width: "100%", height: "100%", minHeight: large ? "460px" : "320px", borderRadius: "12px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <RecenterMap position={busPosition} triggerCenter={centerTrigger} />

        {/* Route Polyline */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#3b82f6",
              weight: 5,
              opacity: 0.75,
              dashArray: "1, 10",
              lineJoin: "round",
            }}
          />
        )}

        {/* Stops */}
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
                <div style={{ padding: "4px" }}>
                  <strong style={{ fontSize: "13px", color: "#1e3a8a" }}>
                    Stop {seq}: {stop.name}
                  </strong>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Bus Marker */}
        {hasGps && (
          <>
            {/* Accuracy radius ring */}
            {location.accuracy && location.accuracy > 0 && location.accuracy < 200 && (
              <CircleMarker
                center={busPosition}
                radius={Math.min(location.accuracy, 40)}
                pathOptions={{
                  color: isLive ? "#2563eb" : "#94a3b8",
                  fillColor: isLive ? "#3b82f6" : "#cbd5e1",
                  fillOpacity: 0.15,
                  weight: 1,
                }}
              />
            )}

            <Marker
              position={busPosition}
              icon={createBusIcon(busNumber, isLive)}
            >
              <Popup>
                <div style={{ padding: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "14px", color: "#1e3a8a" }}>{busNumber}</strong>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        backgroundColor: isLive ? "#dcfce7" : "#f1f5f9",
                        color: isLive ? "#166534" : "#64748b",
                        fontWeight: 700,
                      }}
                    >
                      {isLive ? "LIVE GPS" : "OFFLINE / IDLE"}
                    </span>
                  </div>
                  {location.speed !== undefined && (
                    <div style={{ fontSize: "12px", color: "#334155" }}>
                      Speed: <strong>{location.speed} km/h</strong>
                    </div>
                  )}
                  {location.recordedAt && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      Updated: {new Date(location.recordedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Recenter Button Overlay */}
      {hasGps && (
        <button
          className="button button-white"
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            zIndex: 1000,
            padding: "8px 14px",
            borderRadius: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
          }}
          onClick={() => setCenterTrigger((prev) => prev + 1)}
          title="Center on Bus"
        >
          <LocateFixed size={16} />
          Center Bus
        </button>
      )}

      {!hasGps && (
        <div className="map-empty">
          <span className="map-empty-icon">
            <MapPin size={22} />
          </span>
          <strong>Waiting for live bus GPS</strong>
          <span>The map will show the moving bus marker when a trip starts.</span>
        </div>
      )}

      <div className="map-attribution-note">
        <span className={`live-dot ${isLive ? "" : "live-badge-muted"}`} />
        OpenStreetMap
      </div>
    </div>
  );
}

export default BusMap;
