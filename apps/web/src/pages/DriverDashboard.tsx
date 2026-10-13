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
  X,
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
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </section>

      {/* Success / Error Banners */}
      {successMsg && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            background: "var(--success-50)",
            border: "1px solid var(--success-100)",
            color: "var(--success-700)",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
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
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            background: "var(--danger-50)",
            border: "1px solid var(--danger-100)",
            color: "var(--danger-700)",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            marginBottom: "22px",
          }}
        >
          <ShieldAlert size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ fontSize: "14px" }}>GPS Transmission Interrupted</strong>
            <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: "1.5" }}>
              {gpsErrorMsg}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "var(--danger-700)" }}>
              Tip: Allow location permission in your device settings. In production, HTTPS or native APK provides high-precision geolocation.
            </p>
          </div>
        </div>
      )}

      {/* Assigned Bus Card if not assigned */}
      {!assignedBus && (
        <div
          style={{
            padding: "36px 24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            textAlign: "center",
            marginBottom: "24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <BusFront size={48} color="var(--text-light)" style={{ margin: "0 auto 14px" }} />
          <h2 style={{ fontSize: "18px", color: "var(--navy-900)", margin: "0 0 6px", fontWeight: 800 }}>
            No Bus Currently Assigned
          </h2>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px", maxWidth: "460px", marginLeft: "auto", marginRight: "auto" }}>
            The transport administrator has not yet assigned a bus to your driver account. Contact the campus transport department to assign your vehicle and route.
          </p>
        </div>
      )}

      {assignedBus && (
        <>
          {/* Top Control Bar: Start / End Trip */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
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
                    boxShadow: activeTrip ? "0 0 0 3px rgba(34, 197, 94, 0.25)" : "none",
                  }}
                />
                <h2 style={{ fontSize: "18px", fontWeight: "800", color: "var(--navy-900)", margin: 0 }}>
                  {activeTrip ? "Active Trip in Progress" : "Vehicle Ready for Duty"}
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                {activeTrip
                  ? `Broadcasting real-time coordinates for ${assignedBus.busNumber} (${assignedRoute?.name})`
                  : `Assigned to ${assignedBus.busNumber} (${assignedBus.registrationNumber}). Start trip to begin live sharing.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {!activeTrip ? (
                <button
                  className="button"
                  onClick={handleStartTrip}
                  disabled={isStartingTrip}
                  style={{
                    padding: "0 24px",
                    minHeight: "48px",
                    fontSize: "14px",
                    fontWeight: "800",
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#ffffff",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)",
                  }}
                >
                  <Play size={18} fill="#ffffff" />
                  <span>{isStartingTrip ? "Starting Trip..." : "Start Trip & Broadcast GPS"}</span>
                </button>
              ) : (
                <>
                  <button
                    className="button button-secondary"
                    onClick={togglePauseGps}
                    title={gpsStatus === "paused" ? "Resume GPS transmission" : "Pause GPS transmission"}
                    style={{
                      minHeight: "46px",
                      padding: "0 16px",
                      fontWeight: 700,
                      borderColor: gpsStatus === "paused" ? "var(--warning-500)" : "var(--border)",
                      color: gpsStatus === "paused" ? "var(--warning-700)" : "var(--navy-800)",
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
                    className="button button-danger"
                    onClick={() => setIsEndingTripModalOpen(true)}
                    style={{
                      minHeight: "46px",
                      padding: "0 22px",
                      fontSize: "14px",
                      fontWeight: "800",
                      boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
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
              tag="Assigned Vehicle"
              label="Bus Number"
              value={assignedBus.busNumber}
              footnote={assignedBus.registrationNumber}
            />

            <StatCard
              icon={Clock}
              iconColorClass="purple"
              tag={activeTrip ? "In Progress" : "Off Duty"}
              label="Trip Elapsed"
              value={formatTimer(tripElapsedSeconds)}
              footnote={activeTrip ? "Real-time timer" : "Trip not started"}
            />

            <StatCard
              icon={Signal}
              iconColorClass={gpsStatus === "active" ? "green" : "orange"}
              tag={gpsStatus.toUpperCase()}
              tagColorClass={gpsStatus === "active" ? "green" : "neutral"}
              label="GPS Status"
              value={gpsStatus === "active" ? "Transmitting" : gpsStatus === "paused" ? "Paused" : "Standby"}
              footnote={`${updatesSentCount} telemetry packets sent`}
            />

            <StatCard
              icon={Gauge}
              iconColorClass="orange"
              tag="Speed & Precision"
              label="Current Speed"
              value={currentGps?.speed !== undefined ? `${currentGps.speed} km/h` : "—"}
              footnote={currentGps?.accuracy ? `Accuracy ±${Math.round(currentGps.accuracy)}m` : "No GPS fix"}
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
                  <p>Your current GPS position being streamed to students and administration.</p>
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
                  <RouteIcon size={18} />
                </span>
              </div>

              <div className="trip-route-heading">
                <span className="trip-route-icon">
                  <MapPin size={18} />
                </span>
                <div>
                  <strong>{assignedRoute?.name || "Assigned Route"}</strong>
                  <span>{assignedRoute?.code}</span>
                </div>
              </div>

              <div className="route-timeline" style={{ maxHeight: "360px" }}>
                <div className="timeline-line" />
                {assignedRoute?.stops && Array.isArray(assignedRoute.stops) && assignedRoute.stops.length > 0 ? (
                  assignedRoute.stops.map((stop: any, index: number) => {
                    const stopObj = stop.stopId || stop;
                    return (
                      <div className="timeline-stop" key={index}>
                        <span className={`timeline-dot ${index === 0 ? "timeline-dot-start" : ""}`} />
                        <div>
                          <strong>{stopObj.name || `Stop ${index + 1}`}</strong>
                          <span>Sequence {stop.sequence || index + 1}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>No route stops assigned.</div>
                )}
              </div>
            </article>
          </section>
        </>
      )}

      {/* Confirmation Modal for Ending Trip */}
      {isEndingTripModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--danger-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--danger-600)",
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "var(--navy-900)" }}>End Active Trip?</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsEndingTripModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "13px", color: "var(--navy-700)", lineHeight: "1.6", margin: 0 }}>
                Are you sure you want to end this trip for bus <strong>{assignedBus?.busNumber}</strong>? GPS location broadcasting will terminate and the vehicle status will update to completed for all students.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="button button-secondary"
                onClick={() => setIsEndingTripModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                onClick={handleEndTrip}
                style={{ fontWeight: 700 }}
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
