import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BusFront,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Route as RouteIcon,
  ShieldAlert,
  Signal,
  Square,
} from "lucide-react";
import { api } from "../services/api";
import { startLocationTracking } from "../services/location";
import { BusMap } from "../components/BusMap";
import { StatCard } from "../components/StatCard";
import type { Bus, Location, Route, Trip } from "../types";

export function DriverDashboard() {
  const [assignedBus, setAssignedBus] = useState<Bus | null>(null);
  const [assignedRoute, setAssignedRoute] = useState<Route | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // GPS and Geolocation states
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "active" | "paused" | "denied" | "error">("idle");
  const [currentGps, setCurrentGps] = useState<Location | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState("");
  const [updatesSentCount, setUpdatesSentCount] = useState(0);
  const [isEndingTripModalOpen, setIsEndingTripModalOpen] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [tripElapsedSeconds, setTripElapsedSeconds] = useState(0);

  // Load driver's assigned bus and check for active trip
  const loadDriverData = useCallback(async () => {
    setError("");
    try {
      const [assignedRes, activeTripRes] = await Promise.all([
        api.trips.getDriverAssigned(),
        api.trips.getDriverActive(),
      ]);

      if (assignedRes.data) {
        setAssignedBus(assignedRes.data.bus);
        setAssignedRoute(assignedRes.data.route);
      } else {
        setAssignedBus(null);
        setAssignedRoute(null);
      }

      if (activeTripRes.data) {
        setActiveTrip(activeTripRes.data);
        if (activeTripRes.data.currentLocation) {
          setCurrentGps(activeTripRes.data.currentLocation);
        }
      } else {
        setActiveTrip(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load driver data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDriverData();
  }, [loadDriverData]);

  // Trip duration counter
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== "active") {
      setTripElapsedSeconds(0);
      return;
    }

    const startTimestamp = activeTrip.startedAt
      ? new Date(activeTrip.startedAt).getTime()
      : Date.now();

    const updateTimer = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
      setTripElapsedSeconds(seconds);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [activeTrip]);

  const stopTrackingRef = useRef<(() => void) | null>(null);
  const isPausedRef = useRef(false);

  // Stop watching GPS helper
  const stopGpsWatch = useCallback(() => {
    if (stopTrackingRef.current) {
      stopTrackingRef.current();
      stopTrackingRef.current = null;
    }
    setGpsStatus("idle");
  }, []);

  // Start watching driver GPS across Web, PWA, and Android Native
  const startGpsWatch = useCallback(async (tripId: string) => {
    stopGpsWatch();

    setGpsStatus("requesting");
    setGpsErrorMsg("");
    isPausedRef.current = false;

    try {
      const stop = await startLocationTracking({
        onLocation: async (locData) => {
          if (isPausedRef.current) return;

          setGpsStatus("active");
          setCurrentGps(locData);

          // Send to backend
          try {
            await api.trips.updateLocation(tripId, locData);
            setUpdatesSentCount((c) => c + 1);
          } catch (err: any) {
            console.warn("Location push error:", err?.message || err);
          }
        },
        onError: (err) => {
          console.error("GPS error:", err);
          if (err.code === "PERMISSION_DENIED" || err.code === 1) {
            setGpsStatus("denied");
            setGpsErrorMsg(
              "Location permission was denied. Please allow device location access to broadcast your bus GPS position.",
            );
          } else {
            setGpsStatus("error");
            setGpsErrorMsg(`GPS Error: ${err.message}`);
          }
        },
      });

      stopTrackingRef.current = stop;
    } catch (err: any) {
      setGpsStatus("error");
      setGpsErrorMsg(`GPS Watch Error: ${err?.message || "Failed to initialize location service"}`);
    }
  }, [stopGpsWatch]);

  // Sync GPS watcher when activeTrip changes
  useEffect(() => {
    const tripId = activeTrip?.id || (activeTrip as any)?._id;
    if (activeTrip && activeTrip.status === "active" && tripId) {
      if (!stopTrackingRef.current) {
        void startGpsWatch(tripId);
      }
    } else {
      stopGpsWatch();
    }

    return () => {
      stopGpsWatch();
    };
  }, [activeTrip, startGpsWatch, stopGpsWatch]);

  // Pause / Resume GPS sharing
  const togglePauseGps = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setGpsStatus("active");
    } else {
      isPausedRef.current = true;
      setGpsStatus("paused");
    }
  };

  // Start Trip Handler
  const handleStartTrip = async () => {
    if (!assignedBus) return;
    const busId = assignedBus.id || (assignedBus as any)._id;
    setIsStartingTrip(true);
    setError("");
    setSuccessMsg("");

    try {
      await api.trips.startTrip(busId);
      setSuccessMsg("Trip started successfully! Real-time GPS broadcasting is now active.");
      await loadDriverData();
    } catch (err: any) {
      setError(err.message || "Failed to start trip.");
    } finally {
      setIsStartingTrip(false);
    }
  };

  // End Trip Handler
  const handleEndTrip = async () => {
    const tripId = activeTrip?.id || (activeTrip as any)?._id;
    if (!tripId) return;

    setError("");
    setSuccessMsg("");
    stopGpsWatch();

    try {
      await api.trips.endTrip(tripId);
      setSuccessMsg("Trip ended and marked as completed. GPS transmission stopped.");
      setIsEndingTripModalOpen(false);
      await loadDriverData();
    } catch (err: any) {
      setError(err.message || "Failed to end trip.");
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="loading-indicator" aria-live="polite">
        <span className="loading-spinner" />
        Loading driver portal…
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Welcome header */}
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SVCET FLEET DRIVER CONSOLE
          </div>
          <h1>Driver Operations & GPS</h1>
          <p className="welcome-description">
            Broadcast your vehicle's live mobile GPS position, manage active trips, and view route stops.
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={() => void loadDriverData()}
          title="Refresh assignment and trip status"
        >
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </section>

      {/* Success / Error Banners */}
      {successMsg && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={19} />
          <div>
            <strong>Trip Operation Error</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* GPS Warning if Denied or Error */}
      {(gpsStatus === "denied" || gpsStatus === "error") && (
        <div
          role="alert"
          style={{
            padding: "14px 18px",
            borderRadius: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <ShieldAlert size={22} color="#dc2626" />
          <div>
            <strong>GPS Transmission Interrupted</strong>
            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: "1.5" }}>
              {gpsErrorMsg}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#b91c1c" }}>
              Note: Mobile browser location sharing requires granting permission. In production, HTTPS is required for Geolocation API.
            </p>
          </div>
        </div>
      )}

      {/* Assigned Bus Card if not assigned */}
      {!assignedBus && (
        <div
          style={{
            padding: "24px",
            borderRadius: "14px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <BusFront size={42} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "18px", color: "#1e293b", margin: "0 0 6px" }}>No Bus Currently Assigned</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            The transport administrator has not yet assigned a bus to your driver account. Contact the college transport office to assign your bus and route.
          </p>
        </div>
      )}

      {assignedBus && (
        <>
          {/* Top Control Bar: Start / End Trip */}
          <div
            style={{
              padding: "20px",
              borderRadius: "14px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
              marginBottom: "24px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: activeTrip ? "#22c55e" : "#94a3b8",
                  }}
                />
                <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                  {activeTrip ? "Active Trip in Progress" : "Bus Ready to Depart"}
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                {activeTrip
                  ? `Broadcasting GPS coordinates for ${assignedBus.busNumber} (${assignedRoute?.name})`
                  : `Assigned to ${assignedBus.busNumber} (${assignedBus.registrationNumber}). Start trip to begin live sharing.`}
              </p>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {!activeTrip ? (
                <button
                  className="button button-primary"
                  onClick={handleStartTrip}
                  disabled={isStartingTrip}
                  style={{
                    padding: "12px 24px",
                    fontSize: "14px",
                    fontWeight: "700",
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Play size={18} fill="#ffffff" />
                  <span>{isStartingTrip ? "Starting..." : "Start Trip & Share GPS"}</span>
                </button>
              ) : (
                <>
                  <button
                    className="button button-secondary"
                    onClick={togglePauseGps}
                    title={gpsStatus === "paused" ? "Resume GPS transmission" : "Pause GPS transmission"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      borderColor: gpsStatus === "paused" ? "#f59e0b" : "#cbd5e1",
                    }}
                  >
                    {gpsStatus === "paused" ? (
                      <>
                        <Play size={16} color="#d97706" />
                        <span>Resume GPS</span>
                      </>
                    ) : (
                      <>
                        <Pause size={16} />
                        <span>Pause GPS</span>
                      </>
                    )}
                  </button>

                  <button
                    className="button"
                    onClick={() => setIsEndingTripModalOpen(true)}
                    style={{
                      padding: "12px 22px",
                      fontSize: "14px",
                      fontWeight: "700",
                      background: "#dc2626",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "8px",
                    }}
                  >
                    <Square size={16} fill="#ffffff" />
                    <span>End Trip</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Telemetry Stats Grid */}
          <section className="stats-grid">
            <StatCard
              icon={BusFront}
              iconColorClass="blue"
              tag="Assigned Bus"
              label="Vehicle"
              value={assignedBus.busNumber}
              footnote={assignedBus.registrationNumber}
            />

            <StatCard
              icon={Clock}
              iconColorClass="purple"
              tag={activeTrip ? "In Progress" : "Off Duty"}
              label="Trip Duration"
              value={formatTimer(tripElapsedSeconds)}
              footnote={activeTrip ? "Live timer" : "Trip not started"}
            />

            <StatCard
              icon={Signal}
              iconColorClass={gpsStatus === "active" ? "green" : "orange"}
              tag={gpsStatus.toUpperCase()}
              tagColorClass={gpsStatus === "active" ? "green" : "neutral"}
              label="GPS Status"
              value={gpsStatus === "active" ? "Transmitting" : gpsStatus === "paused" ? "Paused" : "Standby"}
              footnote={`${updatesSentCount} updates transmitted`}
            />

            <StatCard
              icon={Gauge}
              iconColorClass="orange"
              tag="Speed & Precision"
              label="Current Speed"
              value={currentGps?.speed !== undefined ? `${currentGps.speed} km/h` : "—"}
              footnote={currentGps?.accuracy ? `Accuracy ±${Math.round(currentGps.accuracy)}m` : "No fix"}
              isSmallValue
            />
          </section>

          {/* Map and Details Grid */}
          <section className="dashboard-grid">
            {/* Live Map Panel */}
            <article className="panel map-panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title-row">
                    <h2>Live Route & Coordinates</h2>
                    <span className={`live-badge ${gpsStatus === "active" ? "" : "live-badge-muted"}`}>
                      <span className="live-dot" />
                      {gpsStatus === "active" ? "BROADCASTING" : "STANDBY"}
                    </span>
                  </div>
                  <p>Your current GPS position being streamed to students.</p>
                </div>
              </div>

              <BusMap
                location={currentGps}
                stops={assignedRoute?.stops as any}
                geometry={assignedRoute?.geometry}
                busNumber={assignedBus.busNumber}
                isLive={gpsStatus === "active"}
              />

              <div className="map-footer">
                <div className="map-footer-item">
                  <span className={`map-footer-dot ${gpsStatus === "active" ? "" : "live-badge-muted"}`} />
                  <div>
                    <strong>{assignedBus.busNumber}</strong>
                    <span>{assignedRoute?.name}</span>
                  </div>
                </div>
                <div className="map-coordinates">
                  {currentGps
                    ? `${currentGps.latitude.toFixed(5)}, ${currentGps.longitude.toFixed(5)}`
                    : "Awaiting GPS coordinates"}
                </div>
              </div>
            </article>

            {/* Route & Stop Sequence Checklist */}
            <article className="panel trip-panel">
              <div className="panel-header">
                <div>
                  <h2>Assigned Route Stops</h2>
                  <p>{assignedRoute?.name || "Route"}</p>
                </div>
                <span className="panel-header-icon">
                  <RouteIcon size={19} />
                </span>
              </div>

              <div className="trip-route-heading">
                <span className="trip-route-icon">
                  <MapPin size={20} />
                </span>
                <div>
                  <strong>{assignedRoute?.name || "Assigned Route"}</strong>
                  <span>{assignedRoute?.code}</span>
                </div>
              </div>

              <div className="route-timeline">
                <div className="timeline-line" />
                {assignedRoute?.stops && Array.isArray(assignedRoute.stops) && assignedRoute.stops.length > 0 ? (
                  assignedRoute.stops.map((stop: any, index: number) => {
                    const stopObj = stop.stopId || stop;
                    return (
                      <div className="timeline-stop" key={index}>
                        <span className={`timeline-dot ${index === 0 ? "timeline-dot-start" : ""}`} />
                        <div>
                          <strong>{stopObj.name || `Stop ${index + 1}`}</strong>
                          <span>
                            Sequence {stop.sequence || index + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: "12px" }}>No route stops assigned.</div>
                )}
              </div>
            </article>
          </section>
        </>
      )}

      {/* Confirmation Modal for Ending Trip */}
      {isEndingTripModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>End Active Trip?</h3>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", margin: "0 0 20px" }}>
              Are you sure you want to end this trip for bus <strong>{assignedBus?.busNumber}</strong>? GPS location broadcasting will terminate and the bus status will update to completed for all students.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="button button-secondary"
                onClick={() => setIsEndingTripModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button"
                onClick={handleEndTrip}
                style={{ background: "#dc2626", color: "#ffffff", fontWeight: "700" }}
              >
                Yes, End Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;
