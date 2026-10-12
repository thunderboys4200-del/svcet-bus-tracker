import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  BusFront,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MapPin,
  Navigation,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Signal,
} from "lucide-react";
import { api } from "../services/api";
import { getSocket, joinBusRoom, leaveBusRoom } from "../services/socket";
import { BusMap } from "../components/BusMap";
import { StatCard } from "../components/StatCard";
import { calculateRouteEta } from "../utils/eta";
import type { Bus, TrackingData } from "../types";

interface StudentDashboardProps {
  initialBusId?: string;
  activePage?: string;
}

export function StudentDashboard({ initialBusId, activePage }: StudentDashboardProps) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>(initialBusId || "");
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tracking" | "routes" | "notifications">("dashboard");

  // Sync tab with sidebar page selection if provided
  useEffect(() => {
    if (activePage && ["dashboard", "tracking", "routes", "notifications"].includes(activePage)) {
      setActiveTab(activePage as any);
    }
  }, [activePage]);

  // Load available buses
  const loadBuses = useCallback(async () => {
    try {
      const res = await api.trips.getBuses();
      setBuses(res.data);
      if (res.data.length > 0 && !selectedBusId) {
        setSelectedBusId(res.data[0].id || (res.data[0] as any)._id);
      }
    } catch (err: any) {
      console.error("Failed to load buses:", err);
    }
  }, [selectedBusId]);

  // Load tracking data for the selected bus
  const loadTracking = useCallback(async (manual = false) => {
    if (!selectedBusId) return;
    if (manual) setRefreshing(true);

    try {
      const res = await api.trips.getBusTracking(selectedBusId);
      setTracking(res.data);
      setError("");
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err.message || "Unable to fetch tracking data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBusId]);

  useEffect(() => {
    void loadBuses();
  }, [loadBuses]);

  useEffect(() => {
    if (selectedBusId) {
      setLoading(true);
      void loadTracking();
    }
  }, [selectedBusId, loadTracking]);

  // Socket.IO real-time location and trip lifecycle events
  useEffect(() => {
    if (!selectedBusId) return;

    joinBusRoom(selectedBusId);
    const socket = getSocket();

    const handleLocation = (data: any) => {
      if (data.busId === selectedBusId) {
        setTracking((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            trip: {
              id: data.tripId,
              status: "active",
              currentLocation: {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                heading: data.heading,
                speed: data.speed,
                recordedAt: data.recordedAt,
              },
              lastLocationAt: data.recordedAt,
            },
            isLive: true,
            locationAgeMs: 0,
          };
        });
        setLastChecked(new Date());
      }
    };

    const handleTripStarted = (data: any) => {
      if (data.busId === selectedBusId) {
        void loadTracking();
      }
    };

    const handleTripEnded = (data: any) => {
      if (data.busId === selectedBusId) {
        void loadTracking();
      }
    };

    socket.on("bus:location", handleLocation);
    socket.on("trip:started", handleTripStarted);
    socket.on("trip:ended", handleTripEnded);

    // Sensible polling fallback (every 15s instead of aggressive 5s)
    const interval = window.setInterval(() => {
      void loadTracking();
    }, 15000);

    return () => {
      leaveBusRoom(selectedBusId);
      socket.off("bus:location", handleLocation);
      socket.off("trip:started", handleTripStarted);
      socket.off("trip:ended", handleTripEnded);
      window.clearInterval(interval);
    };
  }, [selectedBusId, loadTracking]);

  const bus = tracking?.bus;
  const route = tracking?.route;
  const trip = tracking?.trip;
  const isTripActive = trip?.status === "active";
  const isLive = tracking?.isLive ?? false;
  const location = trip?.currentLocation;

  // Calculate realistic ETA
  const eta = calculateRouteEta(location, route?.stops, isLive);

  const formatTime = (iso?: string) => {
    if (!iso) return "Not available";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? "Not available"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatElapsed = (ms: number | null) => {
    if (ms === null) return "No GPS signal";
    if (ms < 60_000) return "Just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
    return `${Math.floor(ms / 3_600_000)} hr ago`;
  };

  return (
    <div className="page-content">
      {/* Welcome & Bus Picker Row */}
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SVCET CAMPUS STUDENT TRANSPORT
          </div>
          <h1>Live Bus Tracking</h1>
          <p className="welcome-description">
            Monitor real-time college bus transit, view route stop sequences, and check arrival estimates.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* Bus Selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <BusFront size={18} color="#2563eb" />
            <select
              aria-label="Select college bus"
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: "700",
                color: "#1e293b",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {buses.map((b) => (
                <option key={b.id || (b as any)._id} value={b.id || (b as any)._id}>
                  {b.busNumber} — {b.registrationNumber} ({b.assignedRoute?.name || "Route"})
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#64748b" />
          </div>

          <button
            className="button button-secondary refresh-button"
            onClick={() => void loadTracking(true)}
            disabled={refreshing}
            title="Refresh bus telemetry"
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </section>

      {/* Navigation sub-tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px" }}>
        <button
          className={`button ${activeTab === "dashboard" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Overview
        </button>
        <button
          className={`button ${activeTab === "tracking" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("tracking")}
        >
          Full Screen Map
        </button>
        <button
          className={`button ${activeTab === "routes" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("routes")}
        >
          Route & Stops
        </button>
        <button
          className={`button ${activeTab === "notifications" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("notifications")}
        >
          Notifications
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={19} />
          <div>
            <strong>Tracking Status</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Trip Inactive Banner if bus is idle */}
      {!isTripActive && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <Clock3 size={22} color="#2563eb" />
          <div>
            <strong>Bus is Currently Idle / Off-Duty</strong>
            <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "2px" }}>
              Trip has not started yet. When the assigned driver starts the route, live GPS telemetry and real-time movement will appear on the map.
            </div>
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === "dashboard" && (
        <>
          {/* Key Stats Cards */}
          <section className="stats-grid" aria-label="Bus statistics">
            <StatCard
              icon={BusFront}
              iconColorClass="blue"
              tag="Bus Details"
              label="Selected Vehicle"
              value={bus?.busNumber || "BUS-001"}
              footnote={bus?.registrationNumber || "TN10AB1234"}
            />

            <StatCard
              icon={Activity}
              iconColorClass={isLive ? "green" : "orange"}
              tag={isLive ? "Live GPS" : isTripActive ? "Signal Awaiting" : "Offline"}
              tagColorClass={isLive ? "green" : "neutral"}
              label="Transit Status"
              value={isLive ? "En Route (Live)" : isTripActive ? "GPS Connecting" : "Scheduled"}
              footnote={formatElapsed(tracking?.locationAgeMs ?? null)}
            />

            <StatCard
              icon={RouteIcon}
              iconColorClass="purple"
              tag="Assigned Route"
              label="Campus Route"
              value={route?.code || "ROUTE-001"}
              footnote={route?.name || "SVCET Route"}
              isSmallValue
            />

            <StatCard
              icon={Clock3}
              iconColorClass="orange"
              tag="Telemetry"
              label="Last GPS Ping"
              value={formatTime(location?.recordedAt)}
              footnote={lastChecked ? `Checked ${lastChecked.toLocaleTimeString()}` : "Awaiting data"}
              isSmallValue
            />
          </section>

          {/* Map and Route Overview Grid */}
          <section className="dashboard-grid">
            {/* Live Map Panel */}
            <article className="panel map-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title-row">
                    <h2>Live Campus Map</h2>
                    <span className={`live-badge ${isLive ? "" : "live-badge-muted"}`}>
                      <span className="live-dot" />
                      {isLive ? "LIVE TRACKING" : isTripActive ? "TRIP ACTIVE" : "IDLE"}
                    </span>
                  </div>
                  <p>OpenStreetMap live tracking with route stops and bus coordinates.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveTab("tracking")}
                >
                  Expand <Navigation size={15} />
                </button>
              </div>

              <BusMap
                location={location}
                stops={route?.stops}
                geometry={route?.geometry}
                busNumber={bus?.busNumber}
                isLive={isLive}
              />

              <div className="map-footer">
                <div className="map-footer-item">
                  <span className={`map-footer-dot ${isLive ? "" : "live-badge-muted"}`} />
                  <div>
                    <strong>{bus?.busNumber || "BUS-001"}</strong>
                    <span>{tracking?.driverName || "Assigned Driver"}</span>
                  </div>
                </div>
                <div className="map-coordinates">
                  {location
                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                    : "Coordinates unavailable"}
                </div>
              </div>
            </article>

            {/* Trip and ETA Details Panel */}
            <article className="panel trip-panel">
              <div className="panel-header">
                <div>
                  <h2>Arrival & Stops</h2>
                  <p>Route timeline & realistic ETA</p>
                </div>
                <span className="panel-header-icon">
                  <RouteIcon size={19} />
                </span>
              </div>

              {/* Realistic ETA Card */}
              <div
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  background: isLive ? "#f0fdf4" : "#f8fafc",
                  border: isLive ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <Navigation size={16} color={isLive ? "#16a34a" : "#64748b"} />
                  <strong style={{ fontSize: "13px", color: isLive ? "#15803d" : "#475569" }}>
                    Estimated Arrival (ETA)
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#334155", fontWeight: 600 }}>
                  {eta.label}
                </p>
              </div>

              {/* Route stop timeline */}
              <div className="trip-route-heading">
                <span className="trip-route-icon">
                  <MapPin size={20} />
                </span>
                <div>
                  <strong>{route?.name || "SVCET Route"}</strong>
                  <span>{route?.code || "ROUTE-001"}</span>
                </div>
              </div>

              <div className="route-timeline">
                <div className="timeline-line" />
                {route?.stops && route.stops.length > 0 ? (
                  route.stops.map((stop, index) => (
                    <div className="timeline-stop" key={`${stop.name}-${index}`}>
                      <span
                        className={`timeline-dot ${index === 0 ? "timeline-dot-start" : index === (route.stops?.length ?? 0) - 1 ? "timeline-dot-end" : ""}`}
                      />
                      <div>
                        <strong>{stop.name}</strong>
                        <span>Stop {stop.sequence || index + 1}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "12px" }}>No stops defined for this route.</div>
                )}
              </div>

              {/* Driver info card */}
              <div className="trip-driver-card">
                <div className="driver-avatar">
                  {tracking?.driverName ? tracking.driverName.charAt(0).toUpperCase() : "D"}
                </div>
                <div className="driver-info">
                  <span>Assigned Driver</span>
                  <strong>{tracking?.driverName || "Driver"}</strong>
                </div>
                <ShieldCheck size={19} className="driver-verified" />
              </div>
            </article>
          </section>
        </>
      )}

      {/* FULL SCREEN TRACKING TAB */}
      {activeTab === "tracking" && (
        <section className="panel tracking-page-panel">
          <div className="panel-header tracking-page-header">
            <div>
              <div className="panel-title-row">
                <h2>Live Tracking — {bus?.busNumber}</h2>
                <span className={`live-badge ${isLive ? "" : "live-badge-muted"}`}>
                  <span className="live-dot" />
                  {isLive ? "LIVE STREAMING" : "AWAITING GPS"}
                </span>
              </div>
              <p>Full-screen interactive map with route stops and real-time bus marker.</p>
            </div>
            <button
              className="button button-secondary"
              onClick={() => void loadTracking(true)}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>

          <BusMap
            location={location}
            stops={route?.stops}
            geometry={route?.geometry}
            busNumber={bus?.busNumber}
            isLive={isLive}
            large
          />

          <div className="tracking-detail-grid">
            <div className="tracking-detail">
              <span>Bus Number</span>
              <strong>{bus?.busNumber || "—"}</strong>
            </div>
            <div className="tracking-detail">
              <span>Registration</span>
              <strong>{bus?.registrationNumber || "—"}</strong>
            </div>
            <div className="tracking-detail">
              <span>Latitude</span>
              <strong>{location?.latitude?.toFixed(5) ?? "—"}</strong>
            </div>
            <div className="tracking-detail">
              <span>Longitude</span>
              <strong>{location?.longitude?.toFixed(5) ?? "—"}</strong>
            </div>
            <div className="tracking-detail">
              <span>Speed</span>
              <strong>{location?.speed !== undefined ? `${location.speed} km/h` : "—"}</strong>
            </div>
            <div className="tracking-detail">
              <span>GPS Updated</span>
              <strong>{formatTime(location?.recordedAt)}</strong>
            </div>
          </div>
        </section>
      )}

      {/* ROUTES TAB */}
      {activeTab === "routes" && (
        <section className="routes-page-grid">
          <article className="panel route-details-panel">
            <div className="panel-header">
              <div>
                <h2>Route Specifications</h2>
                <p>Campus transport route metadata.</p>
              </div>
              <span className="panel-header-icon">
                <BusFront size={20} />
              </span>
            </div>

            <div className="route-summary-card">
              <div className="route-summary-icon">
                <BusFront size={28} />
              </div>
              <div>
                <span>Selected Bus</span>
                <h3>{bus?.busNumber || "BUS-001"}</h3>
                <p>{bus?.registrationNumber || "TN10AB1234"}</p>
              </div>
              <span className={`live-badge ${isTripActive ? "" : "live-badge-muted"}`}>
                <span className="live-dot" />
                {isTripActive ? "TRIP RUNNING" : "NOT RUNNING"}
              </span>
            </div>

            <div className="detail-list">
              <div><span>Route Name</span><strong>{route?.name || "Route"}</strong></div>
              <div><span>Route Code</span><strong>{route?.code || "ROUTE-001"}</strong></div>
              <div><span>Driver</span><strong>{tracking?.driverName || "Assigned Driver"}</strong></div>
              <div><span>Vehicle Capacity</span><strong>{bus?.capacity || 40} seats</strong></div>
              <div><span>Status</span><strong>{isTripActive ? "Active on Route" : "Parked / Off-Duty"}</strong></div>
            </div>
          </article>

          <article className="panel route-stops-panel">
            <div className="panel-header">
              <div>
                <h2>Sequence of Stops</h2>
                <p>All stops along {route?.name}.</p>
              </div>
              <span className="stop-count">{route?.stops?.length || 0}</span>
            </div>

            {route?.stops && route.stops.length > 0 ? (
              <div className="route-timeline route-timeline-page">
                <div className="timeline-line" />
                {route.stops.map((stop, index) => (
                  <div className="timeline-stop" key={`${stop.name}-${index}`}>
                    <span className={`timeline-dot ${index === 0 ? "timeline-dot-start" : ""}`} />
                    <div>
                      <strong>{stop.name}</strong>
                      <span>
                        Stop {stop.sequence || index + 1} • {stop.latitude?.toFixed(4)}, {stop.longitude?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <MapPin size={28} />
                <strong>No stops configured</strong>
                <p>The administrator has not configured stops for this route yet.</p>
              </div>
            )}
          </article>
        </section>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === "notifications" && (
        <section className="panel notifications-panel">
          <div className="panel-header">
            <div>
              <h2>Transport Notifications</h2>
              <p>Operational updates and live status.</p>
            </div>
            <span className="panel-header-icon">
              <Bell size={20} />
            </span>
          </div>

          <div className="notification-item">
            <div className={`notification-icon ${isTripActive ? "notification-icon-success" : "notification-icon-neutral"}`}>
              {isTripActive ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}
            </div>
            <div className="notification-copy">
              <strong>{isTripActive ? `Bus ${bus?.busNumber} Trip in Progress` : `Bus ${bus?.busNumber} is Currently Idle`}</strong>
              <p>
                {isTripActive
                  ? `Trip started at ${formatTime(trip?.startedAt)}. Driver is actively broadcasting GPS.`
                  : "No active trip is running at this time. Telemetry will resume when the driver starts the trip."}
              </p>
              <span>{formatElapsed(tracking?.locationAgeMs ?? null)}</span>
            </div>
          </div>

          <div className="notification-item">
            <div className={`notification-icon ${isLive ? "notification-icon-success" : "notification-icon-neutral"}`}>
              <Signal size={20} />
            </div>
            <div className="notification-copy">
              <strong>{isLive ? "Live GPS Connected" : "Awaiting Fresh Signal"}</strong>
              <p>
                {location?.recordedAt
                  ? `Last verified location recorded at ${formatTime(location.recordedAt)}.`
                  : "Waiting for driver device geolocation telemetry."}
              </p>
              <span>WebSocket real-time channel enabled</span>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <div className="loading-indicator" aria-live="polite">
          <span className="loading-spinner" />
          Loading bus information…
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;
