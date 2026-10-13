import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BusFront,
  CheckCircle2,
  Edit,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { StatCard } from "../components/StatCard";
import type { Bus, FleetStats, Route, Stop, User } from "../types";

interface AdminDashboardProps {
  activePage?: string;
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function AdminDashboard({ activePage }: AdminDashboardProps = {}) {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<"fleet-overview" | "buses" | "drivers" | "routes" | "stops" | "active-trips">("fleet-overview");

  // Sync tab with sidebar page selection if provided
  useEffect(() => {
    if (!activePage) return;
    if (activePage === "dashboard") setActiveTab("fleet-overview");
    else if (activePage === "buses") setActiveTab("buses");
    else if (activePage === "drivers") setActiveTab("drivers");
    else if (activePage === "routes") setActiveTab("routes");
    else if (activePage === "fleet-map") setActiveTab("active-trips");
    else if (["stops", "active-trips"].includes(activePage)) setActiveTab(activePage as any);
  }, [activePage]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal states
  const [modalType, setModalType] = useState<"bus" | "assign-bus" | "driver" | "stop" | "route" | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [busForm, setBusForm] = useState({ busNumber: "", registrationNumber: "", capacity: 40 });
  const [assignForm, setAssignForm] = useState({ busId: "", assignedRouteId: "", assignedDriverId: "" });
  const [driverForm, setDriverForm] = useState({ collegeId: "", name: "", password: "" });
  const [stopForm, setStopForm] = useState({ name: "", code: "", latitude: 13.143, longitude: 79.908, landmark: "" });

  // Route Form states with reusable stops
  const [routeForm, setRouteForm] = useState<{
    name: string;
    code: string;
    description: string;
    stops: Array<{ stopId: string; sequence: number }>;
  }>({
    name: "",
    code: "",
    description: "",
    stops: [],
  });

  const [routeStopSearch, setRouteStopSearch] = useState("");
  const [showQuickAddStop, setShowQuickAddStop] = useState(false);
  const [quickStopForm, setQuickStopForm] = useState({
    name: "",
    code: "",
    latitude: 13.143,
    longitude: 79.908,
    landmark: "",
  });
  const [proximityWarning, setProximityWarning] = useState<{
    message: string;
    existingStop: any;
    distanceMeters: number;
  } | null>(null);
  const [identicalRouteWarning, setIdenticalRouteWarning] = useState<{
    message: string;
    existingRoute: any;
  } | null>(null);
  const [confirmIdenticalSequence, setConfirmIdenticalSequence] = useState(false);
  const [routeCodeError, setRouteCodeError] = useState("");

  const loadAllData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");

    try {
      const [statsRes, busesRes, driversRes, routesRes, stopsRes, activeTripsRes] = await Promise.all([
        api.admin.getDashboard(),
        api.admin.getBuses(),
        api.admin.getDrivers(),
        api.admin.getRoutes(),
        api.admin.getStops(),
        api.admin.getActiveTrips(),
      ]);

      setStats(statsRes.data);
      setBuses(busesRes.data);
      setDrivers(driversRes.data);
      setRoutes(routesRes.data);
      setStops(stopsRes.data);
      setActiveTrips(activeTripsRes.data);
    } catch (err: any) {
      setError(err.message || "Failed to load admin fleet data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // Bus CRUD
  const handleSaveBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.admin.updateBus(editingItem._id || editingItem.id, busForm);
        showSuccess("Bus updated successfully.");
      } else {
        await api.admin.createBus(busForm);
        showSuccess("Bus created successfully.");
      }
      setModalType(null);
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBus = async (busId: string) => {
    if (!window.confirm("Are you sure you want to delete this bus?")) return;
    try {
      await api.admin.deleteBus(busId);
      showSuccess("Bus deleted successfully.");
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssignBusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.assignBus(
        assignForm.busId,
        assignForm.assignedRouteId || undefined,
        assignForm.assignedDriverId || undefined,
      );
      showSuccess("Bus route & driver assignment saved.");
      setModalType(null);
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Driver CRUD
  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createDriver(driverForm);
      showSuccess("Driver account created successfully.");
      setModalType(null);
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      await api.admin.updateDriverStatus(driverId, !currentStatus);
      showSuccess(`Driver status set to ${!currentStatus ? "Active" : "Inactive"}.`);
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!window.confirm("Are you sure you want to delete this driver account?")) return;
    try {
      await api.admin.deleteDriver(driverId);
      showSuccess("Driver account deleted.");
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Stop CRUD
  const handleSaveStop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.admin.updateStop(editingItem._id || editingItem.id, stopForm);
        showSuccess("Stop updated successfully.");
      } else {
        await api.admin.createStop(stopForm);
        showSuccess("Stop created successfully.");
      }
      setModalType(null);
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!window.confirm("Are you sure you want to delete this stop?")) return;
    try {
      await api.admin.deleteStop(stopId);
      showSuccess("Stop deleted.");
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Route Sequence manipulation (Reusing physical stop records)
  const addStopToRoute = (stopId: string) => {
    setRouteForm((prev) => ({
      ...prev,
      stops: [...prev.stops, { stopId, sequence: prev.stops.length + 1 }],
    }));
  };

  const removeStopFromRoute = (index: number) => {
    setRouteForm((prev) => {
      const filtered = prev.stops.filter((_, idx) => idx !== index);
      const resequenced = filtered.map((s, idx) => ({ ...s, sequence: idx + 1 }));
      return { ...prev, stops: resequenced };
    });
  };

  const moveStopUp = (index: number) => {
    if (index <= 0) return;
    setRouteForm((prev) => {
      const newStops = [...prev.stops];
      const temp = newStops[index - 1];
      newStops[index - 1] = newStops[index];
      newStops[index] = temp;
      const resequenced = newStops.map((s, idx) => ({ ...s, sequence: idx + 1 }));
      return { ...prev, stops: resequenced };
    });
  };

  const moveStopDown = (index: number) => {
    if (index >= routeForm.stops.length - 1) return;
    setRouteForm((prev) => {
      const newStops = [...prev.stops];
      const temp = newStops[index + 1];
      newStops[index + 1] = newStops[index];
      newStops[index] = temp;
      const resequenced = newStops.map((s, idx) => ({ ...s, sequence: idx + 1 }));
      return { ...prev, stops: resequenced };
    });
  };

  // Quick Add Stop from inside Route Builder (with proximity checks)
  const handleVerifyAndQuickAddStop = async (confirmDuplicate = false) => {
    if (!quickStopForm.name.trim()) {
      setError("Stop name is required.");
      return;
    }

    // Proximity check on frontend against existing stops
    if (!confirmDuplicate) {
      let closest: any = null;
      let minDistance = Infinity;

      for (const st of stops) {
        const dist = haversineDistanceMeters(
          quickStopForm.latitude,
          quickStopForm.longitude,
          st.latitude,
          st.longitude,
        );
        const sameName = st.name.toLowerCase() === quickStopForm.name.trim().toLowerCase();

        if (dist <= 60 || (sameName && dist <= 200)) {
          if (dist < minDistance) {
            minDistance = dist;
            closest = st;
          }
        }
      }

      if (closest) {
        setProximityWarning({
          message: `A stop nearby ('${closest.name}') already exists within ${Math.round(minDistance)} meters. Reuse this stop or confirm creation of a distinct stop.`,
          existingStop: closest,
          distanceMeters: Math.round(minDistance),
        });
        return;
      }
    }

    try {
      const res = await api.admin.createStop({
        name: quickStopForm.name.trim(),
        code: quickStopForm.code.trim().toUpperCase() || undefined,
        latitude: quickStopForm.latitude,
        longitude: quickStopForm.longitude,
        landmark: quickStopForm.landmark.trim() || undefined,
        confirmDuplicate,
      });

      const newStop = res.data;
      setStops((prev) => [newStop, ...prev]);
      addStopToRoute(newStop.id || newStop._id!);
      setShowQuickAddStop(false);
      setProximityWarning(null);
      setQuickStopForm({ name: "", code: "", latitude: 13.143, longitude: 79.908, landmark: "" });
      showSuccess(`Stop '${newStop.name}' registered and added to route.`);
    } catch (err: any) {
      if (err.data?.duplicateWarning) {
        setProximityWarning(err.data);
      } else {
        setError(err.message || "Failed to create stop.");
      }
    }
  };

  // Route CRUD Submit
  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setRouteCodeError("");
    setIdenticalRouteWarning(null);

    try {
      if (routeForm.stops.length === 0) {
        throw new Error("Route must contain at least one stop.");
      }

      if (editingItem) {
        await api.admin.updateRoute(editingItem._id || editingItem.id, {
          name: routeForm.name,
          code: routeForm.code,
          description: routeForm.description,
          stops: routeForm.stops,
        });
        showSuccess("Route updated successfully.");
      } else {
        await api.admin.createRoute({
          name: routeForm.name,
          code: routeForm.code,
          description: routeForm.description,
          stops: routeForm.stops,
          confirmIdenticalSequence,
        });
        showSuccess("Route created successfully.");
      }

      setModalType(null);
      setConfirmIdenticalSequence(false);
      void loadAllData();
    } catch (err: any) {
      if (err.data?.duplicateCode) {
        setRouteCodeError(err.message);
      } else if (err.data?.identicalSequenceWarning) {
        setIdenticalRouteWarning(err.data);
      } else {
        setError(err.message || "Failed to save route.");
      }
    }
  };

  const handleEditRoute = (r: any) => {
    setEditingItem(r);
    const existingStops = Array.isArray(r.stops)
      ? r.stops.map((s: any, idx: number) => ({
          stopId: s.stopId?._id || s.stopId || s.id,
          sequence: s.sequence || idx + 1,
        }))
      : [];

    setRouteForm({
      name: r.name,
      code: r.code,
      description: r.description || "",
      stops: existingStops,
    });
    setRouteCodeError("");
    setIdenticalRouteWarning(null);
    setConfirmIdenticalSequence(false);
    setModalType("route");
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!window.confirm("Are you sure you want to delete this route?")) return;
    try {
      await api.admin.deleteRoute(routeId);
      showSuccess("Route deleted.");
      void loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-indicator" aria-live="polite">
        <span className="loading-spinner" />
        Loading fleet administration…
      </div>
    );
  }

  // Filtered stops for search inside Route Builder modal
  const filteredAvailableStops = stops.filter((s) => {
    if (!routeStopSearch.trim()) return true;
    const q = routeStopSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.landmark && s.landmark.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-content">
      {/* Header */}
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SVCET TRANSPORT ADMINISTRATION
          </div>
          <h1>Fleet Control Center</h1>
          <p className="welcome-description">
            Manage college buses, drivers, routes, stops, and monitor active fleet operations in real time.
          </p>
        </div>

        <button
          className="button button-secondary"
          onClick={() => void loadAllData(true)}
          disabled={refreshing}
          title="Refresh all records"
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Data"}</span>
        </button>
      </section>

      {/* Notifications */}
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
            <strong>Error</strong>
            <span>{error}</span>
          </div>
          <button className="icon-button" onClick={() => setError("")} style={{ marginLeft: "auto", padding: "4px" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "12px",
          marginBottom: "22px",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`button ${activeTab === "fleet-overview" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("fleet-overview")}
        >
          Fleet Overview
        </button>
        <button
          className={`button ${activeTab === "buses" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("buses")}
        >
          Buses ({buses.length})
        </button>
        <button
          className={`button ${activeTab === "drivers" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("drivers")}
        >
          Drivers ({drivers.length})
        </button>
        <button
          className={`button ${activeTab === "routes" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("routes")}
        >
          Routes ({routes.length})
        </button>
        <button
          className={`button ${activeTab === "stops" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("stops")}
        >
          Stops ({stops.length})
        </button>
        <button
          className={`button ${activeTab === "active-trips" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("active-trips")}
        >
          Active Trips ({activeTrips.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "fleet-overview" && (
        <>
          <section className="stats-grid">
            <StatCard
              icon={BusFront}
              iconColorClass="blue"
              tag="Total Fleet"
              label="College Buses"
              value={stats?.totalBuses ?? buses.length}
              footnote="Total registered transport vehicles"
            />
            <StatCard
              icon={Activity}
              iconColorClass="green"
              tag="Live Operations"
              label="Active Trips"
              value={stats?.activeTrips ?? activeTrips.length}
              footnote="Buses currently broadcasting live GPS"
            />
            <StatCard
              icon={RouteIcon}
              iconColorClass="purple"
              tag="Network"
              label="Campus Routes"
              value={stats?.totalRoutes ?? routes.length}
              footnote="Covering college pickup & drop stops"
            />
            <StatCard
              icon={Users}
              iconColorClass="orange"
              tag="Staff"
              label="Registered Drivers"
              value={stats?.totalDrivers ?? drivers.length}
              footnote="Authorized vehicle operators"
            />
          </section>

          {/* Quick Summary Grid */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginTop: "12px" }}>
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Buses & Route Assignments</h2>
                  <p>Recent bus assignments</p>
                </div>
                <button className="button button-secondary" onClick={() => setActiveTab("buses")}>View All</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {buses.slice(0, 5).map((b) => (
                  <div
                    key={b.id || (b as any)._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "var(--surface-subtle)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--navy-900)", fontSize: "13px" }}>{b.busNumber}</strong>{" "}
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>({b.registrationNumber})</span>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        Route: {b.assignedRoute?.name || "Unassigned"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--primary-600)", fontWeight: 700 }}>
                      Driver: {b.assignedDriverName || "None"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Campus Routes Network</h2>
                  <p>Active configured route corridors</p>
                </div>
                <button className="button button-secondary" onClick={() => setActiveTab("routes")}>View All</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {routes.slice(0, 5).map((r: any) => (
                  <div
                    key={r._id || r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "var(--surface-subtle)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--navy-900)", fontSize: "13px" }}>{r.name}</strong>{" "}
                      <span style={{ color: "var(--primary-600)", fontWeight: 700, fontSize: "12px" }}>({r.code})</span>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {r.stops?.length || 0} stops sequenced along path
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}

      {/* BUSES TAB */}
      {activeTab === "buses" && (
        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>College Buses Fleet</h2>
              <p>Manage college vehicles and their route & driver assignments.</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setEditingItem(null);
                setBusForm({ busNumber: "", registrationNumber: "", capacity: 40 });
                setModalType("bus");
              }}
            >
              <Plus size={16} /> Add Bus
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bus Number</th>
                  <th>Registration</th>
                  <th>Assigned Route</th>
                  <th>Assigned Driver</th>
                  <th>Capacity</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b: any) => (
                  <tr key={b._id || b.id}>
                    <td style={{ fontWeight: 800, color: "var(--navy-900)" }}>{b.busNumber}</td>
                    <td>{b.registrationNumber}</td>
                    <td>
                      {b.assignedRouteId?.name ? (
                        <span className="badge-pill badge-success">
                          {b.assignedRouteId.name} ({b.assignedRouteId.code})
                        </span>
                      ) : b.assignedRoute?.name ? (
                        <span className="badge-pill badge-success">
                          {b.assignedRoute.name}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-light)" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {b.assignedDriverId?.name ? (
                        <span style={{ fontWeight: 600 }}>{b.assignedDriverId.name}</span>
                      ) : b.assignedDriverName && b.assignedDriverName !== "Unassigned" ? (
                        <span style={{ fontWeight: 600 }}>{b.assignedDriverName}</span>
                      ) : (
                        <span style={{ color: "var(--text-light)" }}>Unassigned</span>
                      )}
                    </td>
                    <td>{b.capacity || 40} seats</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="button button-secondary"
                        style={{ padding: "0 10px", minHeight: "32px", marginRight: "6px", fontSize: "11px" }}
                        onClick={() => {
                          setAssignForm({
                            busId: b._id || b.id,
                            assignedRouteId: b.assignedRouteId?._id || b.assignedRouteId?.id || b.assignedRouteId || "",
                            assignedDriverId: b.assignedDriverId?._id || b.assignedDriverId?.id || b.assignedDriverId || "",
                          });
                          setModalType("assign-bus");
                        }}
                      >
                        Assign
                      </button>
                      <button
                        className="button button-secondary"
                        style={{ padding: "0 8px", minHeight: "32px", marginRight: "6px" }}
                        title="Edit Bus Details"
                        onClick={() => {
                          setEditingItem(b);
                          setBusForm({
                            busNumber: b.busNumber,
                            registrationNumber: b.registrationNumber,
                            capacity: b.capacity || 40,
                          });
                          setModalType("bus");
                        }}
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        className="button"
                        style={{
                          padding: "0 8px",
                          minHeight: "32px",
                          background: "var(--danger-50)",
                          color: "var(--danger-600)",
                          border: "1px solid var(--danger-100)",
                        }}
                        title="Delete Bus"
                        onClick={() => handleDeleteBus(b._id || b.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* DRIVERS TAB */}
      {activeTab === "drivers" && (
        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Campus Drivers</h2>
              <p>Driver accounts authorized to log into the driver portal and broadcast GPS.</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setEditingItem(null);
                setDriverForm({ collegeId: "", name: "", password: "" });
                setModalType("driver");
              }}
            >
              <Plus size={16} /> Add Driver
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>College ID</th>
                  <th>Driver Name</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d: any) => (
                  <tr key={d._id || d.id}>
                    <td style={{ fontWeight: 800, color: "var(--navy-900)" }}>{d.collegeId}</td>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td>
                      <span className={`badge-pill ${d.active ? "badge-success" : "badge-danger"}`}>
                        {d.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="button button-secondary"
                        style={{ padding: "0 10px", minHeight: "32px", marginRight: "6px", fontSize: "11px" }}
                        onClick={() => handleToggleDriverStatus(d._id || d.id, !!d.active)}
                      >
                        {d.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="button"
                        style={{
                          padding: "0 8px",
                          minHeight: "32px",
                          background: "var(--danger-50)",
                          color: "var(--danger-600)",
                          border: "1px solid var(--danger-100)",
                        }}
                        title="Delete Driver Account"
                        onClick={() => handleDeleteDriver(d._id || d.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ROUTES TAB */}
      {activeTab === "routes" && (
        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Campus Routes</h2>
              <p>Configure reusable routes and define custom stop sequences for each route variation.</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setEditingItem(null);
                setRouteForm({ name: "", code: "", description: "", stops: [] });
                setRouteCodeError("");
                setIdenticalRouteWarning(null);
                setConfirmIdenticalSequence(false);
                setModalType("route");
              }}
            >
              <Plus size={16} /> Create Route
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route Code</th>
                  <th>Route Name</th>
                  <th>Ordered Stops Sequence</th>
                  <th>Assigned Buses</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r: any) => {
                  const rId = r._id || r.id;
                  const assignedBusesList = buses.filter(
                    (b: any) => (b.assignedRouteId?._id || b.assignedRouteId?.id || b.assignedRouteId) === rId
                  );

                  return (
                    <tr key={rId}>
                      <td style={{ fontWeight: 800, color: "var(--primary-600)" }}>{r.code}</td>
                      <td style={{ fontWeight: 700 }}>{r.name}</td>
                      <td>
                        {Array.isArray(r.stops) && r.stops.length > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            {r.stops.map((s: any, idx: number) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "2px 7px",
                                  background: "var(--surface-subtle)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-xs)",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {idx + 1}. {s.stopId?.name || s.name || "Stop"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-light)" }}>No stops</span>
                        )}
                      </td>
                      <td>
                        {assignedBusesList.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {assignedBusesList.map((b) => (
                              <span
                                key={b.id || (b as any)._id}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "var(--radius-xs)",
                                  background: "var(--primary-50)",
                                  color: "var(--primary-700)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                {b.busNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-light)", fontSize: "12px" }}>0 buses</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="button button-secondary"
                          style={{ padding: "0 8px", minHeight: "32px", marginRight: "6px" }}
                          onClick={() => handleEditRoute(r)}
                          title="Edit Route"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          className="button"
                          style={{
                            padding: "0 8px",
                            minHeight: "32px",
                            background: "var(--danger-50)",
                            color: "var(--danger-600)",
                            border: "1px solid var(--danger-100)",
                          }}
                          onClick={() => handleDeleteRoute(rId)}
                          title="Delete Route"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* STOPS TAB */}
      {activeTab === "stops" && (
        <section className="panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Geographic Campus Stops</h2>
              <p>Reusable physical bus stop locations shared across multiple routes.</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setEditingItem(null);
                setStopForm({ name: "", code: "", latitude: 13.143, longitude: 79.908, landmark: "" });
                setModalType("stop");
              }}
            >
              <Plus size={16} /> Add Stop
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stop Name</th>
                  <th>Stop Code</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Shared in Routes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s: any) => {
                  const sId = s._id || s.id;
                  const routesUsingStop = routes.filter((r: any) =>
                    Array.isArray(r.stops) && r.stops.some((st: any) => (st.stopId?._id || st.stopId || st.id) === sId)
                  );

                  return (
                    <tr key={sId}>
                      <td style={{ fontWeight: 800, color: "var(--navy-900)" }}>{s.name}</td>
                      <td style={{ color: "var(--text-muted)" }}>{s.code || "—"}</td>
                      <td style={{ fontFamily: "monospace" }}>{s.latitude.toFixed(5)}</td>
                      <td style={{ fontFamily: "monospace" }}>{s.longitude.toFixed(5)}</td>
                      <td>
                        {routesUsingStop.length > 0 ? (
                          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                            {routesUsingStop.map((r: any) => (
                              <span
                                key={r._id || r.id}
                                className="badge-pill badge-success"
                              >
                                {r.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-light)", fontSize: "12px" }}>Unused</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="button button-secondary"
                          style={{ padding: "0 8px", minHeight: "32px", marginRight: "6px" }}
                          onClick={() => {
                            setEditingItem(s);
                            setStopForm({
                              name: s.name,
                              code: s.code || "",
                              latitude: s.latitude,
                              longitude: s.longitude,
                              landmark: s.landmark || "",
                            });
                            setModalType("stop");
                          }}
                          title="Edit Stop"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          className="button"
                          style={{
                            padding: "0 8px",
                            minHeight: "32px",
                            background: "var(--danger-50)",
                            color: "var(--danger-600)",
                            border: "1px solid var(--danger-100)",
                          }}
                          onClick={() => handleDeleteStop(sId)}
                          title={routesUsingStop.length > 0 ? "Shared by active routes" : "Delete stop"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ACTIVE TRIPS TAB */}
      {activeTab === "active-trips" && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Live Active Trips</h2>
              <p>Fleet vehicles currently on the road with live GPS streaming.</p>
            </div>
            <button className="button button-secondary" onClick={() => void loadAllData(true)}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bus</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Live Coordinates</th>
                  <th>Speed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                      No active trips currently in progress. When drivers start trips, live GPS updates will appear here.
                    </td>
                  </tr>
                ) : (
                  activeTrips.map((t: any) => (
                    <tr key={t._id || t.id}>
                      <td style={{ fontWeight: 800, color: "var(--navy-900)" }}>{t.busId?.busNumber || "Bus"}</td>
                      <td style={{ fontWeight: 600 }}>{t.driverId?.name || "Driver"}</td>
                      <td>{t.routeId?.name || "Route"}</td>
                      <td style={{ fontFamily: "monospace" }}>
                        {t.currentLocation
                          ? `${t.currentLocation.latitude.toFixed(4)}, ${t.currentLocation.longitude.toFixed(4)}`
                          : "Awaiting Fix"}
                      </td>
                      <td>{t.currentLocation?.speed ? `${t.currentLocation.speed} km/h` : "—"}</td>
                      <td>
                        <span className="badge-pill badge-success">
                          LIVE ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Add / Edit Bus Modal */}
      {modalType === "bus" && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? "Edit Bus Details" : "Add New Fleet Bus"}</h3>
              <button className="icon-button" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveBus}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Bus Number</label>
                  <input
                    required
                    className="form-input"
                    placeholder="e.g. BUS-002"
                    value={busForm.busNumber}
                    onChange={(e) => setBusForm({ ...busForm, busNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Registration Number</label>
                  <input
                    required
                    className="form-input"
                    placeholder="e.g. TN10XY9876"
                    value={busForm.registrationNumber}
                    onChange={(e) => setBusForm({ ...busForm, registrationNumber: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Passenger Capacity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="form-input"
                    value={busForm.capacity}
                    onChange={(e) => setBusForm({ ...busForm, capacity: parseInt(e.target.value, 10) || 40 })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Save Bus</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Assign Bus Modal */}
      {modalType === "assign-bus" && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-card" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Route & Driver to Bus</h3>
              <button className="icon-button" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            {(() => {
              const currentBus = buses.find((b) => (b.id || (b as any)._id) === assignForm.busId);
              const busHasActiveTrip = activeTrips.some(
                (t: any) => (t.busId?._id || t.busId?.id || t.busId) === assignForm.busId
              );

              return (
                <form onSubmit={handleAssignBusSubmit}>
                  <div className="modal-body">
                    {busHasActiveTrip && (
                      <div style={{ padding: "10px 14px", background: "var(--warning-50)", border: "1px solid var(--warning-100)", borderRadius: "var(--radius-sm)", color: "var(--warning-700)", fontSize: "12px", marginBottom: "14px" }}>
                        ⚠️ Notice: This bus has an active trip in progress. Route cannot be changed until the active trip is completed.
                      </div>
                    )}

                    <div style={{ padding: "10px 14px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: "16px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Target Vehicle</span>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--navy-900)" }}>
                        {currentBus?.busNumber} ({currentBus?.registrationNumber})
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Assign Route (Multiple buses can share a route)</label>
                      <select
                        className="form-select"
                        value={assignForm.assignedRouteId}
                        onChange={(e) => setAssignForm({ ...assignForm, assignedRouteId: e.target.value })}
                      >
                        <option value="">-- No Route Assigned --</option>
                        {routes.map((r: any) => {
                          const rId = r._id || r.id;
                          const count = buses.filter(
                            (b: any) => (b.assignedRouteId?._id || b.assignedRouteId?.id || b.assignedRouteId) === rId
                          ).length;

                          return (
                            <option key={rId} value={rId}>
                              {r.name} ({r.code}) — {count} {count === 1 ? "bus" : "buses"} assigned
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Assign Driver</label>
                      <select
                        className="form-select"
                        value={assignForm.assignedDriverId}
                        onChange={(e) => setAssignForm({ ...assignForm, assignedDriverId: e.target.value })}
                      >
                        <option value="">-- No Driver Assigned --</option>
                        {drivers.map((d: any) => (
                          <option key={d._id || d.id} value={d._id || d.id}>
                            {d.name} ({d.collegeId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                    <button type="submit" className="button button-primary">Save Assignment</button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. Add Driver Modal */}
      {modalType === "driver" && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Driver Account</h3>
              <button className="icon-button" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveDriver}>
              <div className="modal-body">
                <div className="form-group">
                  <label>College ID</label>
                  <input
                    required
                    className="form-input"
                    placeholder="e.g. DRIVER002"
                    value={driverForm.collegeId}
                    onChange={(e) => setDriverForm({ ...driverForm, collegeId: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label>Driver Full Name</label>
                  <input
                    required
                    className="form-input"
                    placeholder="e.g. Ramesh Kumar"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Initial Password (min 8 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="form-input"
                    placeholder="Minimum 8 characters"
                    value={driverForm.password}
                    onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Create Driver</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add/Edit Stop Modal */}
      {modalType === "stop" && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div className="modal-card" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? "Edit Stop Details" : "Add Physical Stop Location"}</h3>
              <button className="icon-button" onClick={() => setModalType(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveStop}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Stop Name</label>
                  <input
                    required
                    className="form-input"
                    placeholder="e.g. Main Gate"
                    value={stopForm.name}
                    onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Stop Code (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. STOP-01"
                    value={stopForm.code}
                    onChange={(e) => setStopForm({ ...stopForm, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="form-input"
                      value={stopForm.latitude}
                      onChange={(e) => setStopForm({ ...stopForm, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="form-input"
                      value={stopForm.longitude}
                      onChange={(e) => setStopForm({ ...stopForm, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Landmark / Notes (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Opposite to College Library"
                    value={stopForm.landmark}
                    onChange={(e) => setStopForm({ ...stopForm, landmark: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Save Stop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Rich Route Builder Modal (Reusable Stops & Sequencing) */}
      {modalType === "route" && (
        <div className="modal-backdrop" onClick={() => setModalType(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: "620px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingItem ? "Edit Campus Route" : "Create Route with Reusable Stops"}</h3>
              <button className="icon-button" onClick={() => setModalType(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRoute}>
              <div className="modal-body">
                {/* Route Name & Code */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Route Name</label>
                    <input
                      required
                      className="form-input"
                      placeholder="e.g. SVCET Main Gate Route"
                      value={routeForm.name}
                      onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Route Code</label>
                    <input
                      required
                      className="form-input"
                      placeholder="e.g. ROUTE-002"
                      value={routeForm.code}
                      onChange={(e) => {
                        setRouteCodeError("");
                        setRouteForm({ ...routeForm, code: e.target.value.toUpperCase() });
                      }}
                      style={{ borderColor: routeCodeError ? "var(--danger-500)" : undefined }}
                    />
                    {routeCodeError && (
                      <div style={{ color: "var(--danger-600)", fontSize: "11px", marginTop: "4px" }}>{routeCodeError}</div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Description (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Morning express campus route via Main Gate"
                    value={routeForm.description}
                    onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  />
                </div>

                {/* Identical Sequence Notice */}
                {identicalRouteWarning && (
                  <div style={{ padding: "12px 14px", background: "var(--warning-50)", border: "1px solid var(--warning-100)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--warning-700)", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
                      <AlertTriangle size={15} /> Identical Stop Sequence Found
                    </div>
                    <p style={{ margin: "0 0 8px" }}>{identicalRouteWarning.message}</p>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={confirmIdenticalSequence}
                        onChange={(e) => setConfirmIdenticalSequence(e.target.checked)}
                      />
                      <span>Yes, create this separately as an operational route variation</span>
                    </label>
                  </div>
                )}

                {/* Section 1: Ordered Stops on this Route */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--navy-900)" }}>
                      Ordered Stops on this Route ({routeForm.stops.length})
                    </label>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Use arrows to arrange pickup order</span>
                  </div>

                  <div
                    style={{
                      maxHeight: "180px",
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "8px",
                      background: "var(--surface-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {routeForm.stops.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "var(--text-light)", fontSize: "12px" }}>
                        No stops added yet. Select existing stops below or register a new stop.
                      </div>
                    ) : (
                      routeForm.stops.map((s, idx) => {
                        const stopDetail = stops.find((st: any) => (st._id || st.id) === s.stopId);
                        return (
                          <div
                            key={`${s.stopId}-${idx}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              background: "var(--surface)",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "50%",
                                  background: "var(--primary-600)",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <div>
                                <strong style={{ color: "var(--navy-900)" }}>{stopDetail?.name || "Stop"}</strong>
                                <span style={{ color: "var(--text-muted)", marginLeft: "6px", fontSize: "11px" }}>
                                  ({stopDetail?.latitude?.toFixed(4)}, {stopDetail?.longitude?.toFixed(4)})
                                </span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <button
                                type="button"
                                className="icon-button"
                                disabled={idx === 0}
                                onClick={() => moveStopUp(idx)}
                                title="Move Earlier"
                                style={{ minWidth: "28px", minHeight: "28px", padding: "4px", opacity: idx === 0 ? 0.3 : 1 }}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                disabled={idx === routeForm.stops.length - 1}
                                onClick={() => moveStopDown(idx)}
                                title="Move Later"
                                style={{ minWidth: "28px", minHeight: "28px", padding: "4px", opacity: idx === routeForm.stops.length - 1 ? 0.3 : 1 }}
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={() => removeStopFromRoute(idx)}
                                title="Remove from Route"
                                style={{ minWidth: "28px", minHeight: "28px", padding: "4px", color: "var(--danger-600)" }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Section 2: Reusable Existing Stops Selector */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px", color: "var(--navy-900)" }}>
                    Add Existing Campus Stops (Reuses Physical Location)
                  </label>
                  <div style={{ position: "relative", marginBottom: "8px" }}>
                    <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
                    <input
                      placeholder="Search by stop name or code..."
                      value={routeStopSearch}
                      onChange={(e) => setRouteStopSearch(e.target.value)}
                      className="form-input"
                      style={{ paddingLeft: "32px", fontSize: "12px", height: "36px" }}
                    />
                  </div>

                  <div
                    style={{
                      maxHeight: "130px",
                      overflowY: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "6px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    {filteredAvailableStops.map((st: any) => {
                      const stId = st._id || st.id;
                      const countInRoute = routeForm.stops.filter((s) => s.stopId === stId).length;

                      return (
                        <div
                          key={stId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            background: countInRoute > 0 ? "var(--primary-50)" : "var(--surface)",
                            border: countInRoute > 0 ? "1px solid var(--primary-200)" : "1px solid var(--border)",
                            borderRadius: "var(--radius-xs)",
                            fontSize: "11px",
                          }}
                        >
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <strong>{st.name}</strong>
                            {st.code && <span style={{ color: "var(--text-muted)", marginLeft: "4px" }}>({st.code})</span>}
                          </div>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ padding: "0 6px", minHeight: "24px", fontSize: "10px", flexShrink: 0 }}
                            onClick={() => addStopToRoute(stId)}
                          >
                            + Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Quick Add Stop Inline */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  {!showQuickAddStop ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setShowQuickAddStop(true)}
                      style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
                    >
                      + Register Genuinely New Stop Location
                    </button>
                  ) : (
                    <div style={{ padding: "14px", background: "var(--surface-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <strong style={{ fontSize: "12px", color: "var(--navy-900)" }}>Register & Add New Stop</strong>
                        <button type="button" className="icon-button" onClick={() => setShowQuickAddStop(false)} style={{ padding: "2px", minWidth: "24px", minHeight: "24px" }}>
                          <X size={15} />
                        </button>
                      </div>

                      {proximityWarning && (
                        <div style={{ padding: "10px 12px", background: "var(--danger-50)", border: "1px solid var(--danger-100)", borderRadius: "var(--radius-sm)", fontSize: "12px", color: "var(--danger-700)", marginBottom: "10px" }}>
                          <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ Proximity / Duplicate Alert</div>
                          <p style={{ margin: "0 0 8px" }}>{proximityWarning.message}</p>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              className="button button-primary"
                              style={{ padding: "0 8px", minHeight: "28px", fontSize: "11px" }}
                              onClick={() => {
                                addStopToRoute(proximityWarning.existingStop.id);
                                setShowQuickAddStop(false);
                                setProximityWarning(null);
                              }}
                            >
                              Reuse '{proximityWarning.existingStop.name}'
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ padding: "0 8px", minHeight: "28px", fontSize: "11px" }}
                              onClick={() => void handleVerifyAndQuickAddStop(true)}
                            >
                              Create Distinct Stop
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                        <input
                          placeholder="Stop Name (e.g. Science Block)"
                          value={quickStopForm.name}
                          onChange={(e) => setQuickStopForm({ ...quickStopForm, name: e.target.value })}
                          className="form-input"
                          style={{ fontSize: "12px", height: "36px" }}
                        />
                        <input
                          placeholder="Stop Code (optional)"
                          value={quickStopForm.code}
                          onChange={(e) => setQuickStopForm({ ...quickStopForm, code: e.target.value.toUpperCase() })}
                          className="form-input"
                          style={{ fontSize: "12px", height: "36px" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                        <input
                          type="number"
                          step="any"
                          placeholder="Latitude"
                          value={quickStopForm.latitude}
                          onChange={(e) => setQuickStopForm({ ...quickStopForm, latitude: parseFloat(e.target.value) || 0 })}
                          className="form-input"
                          style={{ fontSize: "12px", height: "36px" }}
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder="Longitude"
                          value={quickStopForm.longitude}
                          onChange={(e) => setQuickStopForm({ ...quickStopForm, longitude: parseFloat(e.target.value) || 0 })}
                          className="form-input"
                          style={{ fontSize: "12px", height: "36px" }}
                        />
                      </div>

                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => void handleVerifyAndQuickAddStop(false)}
                        style={{ width: "100%", justifyContent: "center", fontSize: "12px", minHeight: "36px" }}
                      >
                        Verify & Add Stop to Route
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-footer">
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">
                  {editingItem ? "Update Route" : "Save Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
