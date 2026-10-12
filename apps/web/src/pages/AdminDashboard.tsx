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
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          <span>{refreshing ? "Refreshing..." : "Refresh Data"}</span>
        </button>
      </section>

      {/* Notifications */}
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
            <strong>Error</strong>
            <span>{error}</span>
          </div>
          <button className="icon-button" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
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
          <section className="stats-row">
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
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
            <article className="panel">
              <div className="panel-header">
                <h2>Buses & Route Assignments</h2>
                <button className="button button-secondary" onClick={() => setActiveTab("buses")}>View All</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {buses.slice(0, 5).map((b) => (
                  <div key={b.id || (b as any)._id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div>
                      <strong>{b.busNumber}</strong> ({b.registrationNumber})
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        Route: {b.assignedRoute?.name || "Unassigned"}
                      </div>
                    </div>
                    <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                      Driver: {b.assignedDriverName || "None"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Recent Campus Routes</h2>
                <button className="button button-secondary" onClick={() => setActiveTab("routes")}>View All</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {routes.slice(0, 5).map((r: any) => (
                  <div key={r._id || r.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div>
                      <strong>{r.name}</strong> ({r.code})
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {r.stops?.length || 0} stops sequenced
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "12px" }}>Bus Number</th>
                  <th style={{ padding: "12px" }}>Registration</th>
                  <th style={{ padding: "12px" }}>Assigned Route</th>
                  <th style={{ padding: "12px" }}>Assigned Driver</th>
                  <th style={{ padding: "12px" }}>Capacity</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b: any) => (
                  <tr key={b._id || b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: "700" }}>{b.busNumber}</td>
                    <td style={{ padding: "12px" }}>{b.registrationNumber}</td>
                    <td style={{ padding: "12px" }}>
                      {b.assignedRouteId?.name ? (
                        <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                          {b.assignedRouteId.name} ({b.assignedRouteId.code})
                        </span>
                      ) : b.assignedRoute?.name ? (
                        <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                          {b.assignedRoute.name}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {b.assignedDriverId?.name ? (
                        <span>{b.assignedDriverId.name}</span>
                      ) : b.assignedDriverName && b.assignedDriverName !== "Unassigned" ? (
                        <span>{b.assignedDriverName}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>{b.capacity || 40} seats</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <button
                        className="button button-secondary"
                        style={{ padding: "5px 9px", marginRight: "6px", fontSize: "11px" }}
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
                        style={{ padding: "5px 9px", marginRight: "6px", fontSize: "11px" }}
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
                        <Edit size={12} />
                      </button>
                      <button
                        className="button"
                        style={{ padding: "5px 9px", fontSize: "11px", background: "#fee2e2", color: "#dc2626" }}
                        onClick={() => handleDeleteBus(b._id || b.id)}
                      >
                        <Trash2 size={12} />
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "12px" }}>College ID</th>
                  <th style={{ padding: "12px" }}>Driver Name</th>
                  <th style={{ padding: "12px" }}>Status</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d: any) => (
                  <tr key={d._id || d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: "700" }}>{d.collegeId}</td>
                    <td style={{ padding: "12px" }}>{d.name}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          backgroundColor: d.active ? "#dcfce7" : "#fee2e2",
                          color: d.active ? "#166534" : "#991b1b",
                        }}
                      >
                        {d.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <button
                        className="button button-secondary"
                        style={{ padding: "5px 9px", marginRight: "6px", fontSize: "11px" }}
                        onClick={() => handleToggleDriverStatus(d._id || d.id, !!d.active)}
                      >
                        {d.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="button"
                        style={{ padding: "5px 9px", fontSize: "11px", background: "#fee2e2", color: "#dc2626" }}
                        onClick={() => handleDeleteDriver(d._id || d.id)}
                      >
                        <Trash2 size={12} />
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "12px" }}>Route Code</th>
                  <th style={{ padding: "12px" }}>Route Name</th>
                  <th style={{ padding: "12px" }}>Ordered Stops Sequence</th>
                  <th style={{ padding: "12px" }}>Assigned Buses</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r: any) => {
                  const rId = r._id || r.id;
                  const assignedBusesList = buses.filter(
                    (b: any) => (b.assignedRouteId?._id || b.assignedRouteId?.id || b.assignedRouteId) === rId
                  );

                  return (
                    <tr key={rId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "700", color: "#2563eb" }}>{r.code}</td>
                      <td style={{ padding: "12px", fontWeight: "600" }}>{r.name}</td>
                      <td style={{ padding: "12px" }}>
                        {Array.isArray(r.stops) && r.stops.length > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            {r.stops.map((s: any, idx: number) => (
                              <span
                                key={idx}
                                style={{
                                  padding: "2px 7px",
                                  background: "#f1f5f9",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                }}
                              >
                                {idx + 1}. {s.stopId?.name || s.name || "Stop"}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No stops</span>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {assignedBusesList.length > 0 ? (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                            {assignedBusesList.map((b) => (
                              <span
                                key={b.id || (b as any)._id}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#e0f2fe",
                                  color: "#0369a1",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {b.busNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>0 buses</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          className="button button-secondary"
                          style={{ padding: "5px 9px", marginRight: "6px", fontSize: "11px" }}
                          onClick={() => handleEditRoute(r)}
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          className="button"
                          style={{ padding: "5px 9px", fontSize: "11px", background: "#fee2e2", color: "#dc2626" }}
                          onClick={() => handleDeleteRoute(rId)}
                        >
                          <Trash2 size={12} />
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "12px" }}>Stop Name</th>
                  <th style={{ padding: "12px" }}>Stop Code</th>
                  <th style={{ padding: "12px" }}>Latitude</th>
                  <th style={{ padding: "12px" }}>Longitude</th>
                  <th style={{ padding: "12px" }}>Shared in Routes</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s: any) => {
                  const sId = s._id || s.id;
                  const routesUsingStop = routes.filter((r: any) =>
                    Array.isArray(r.stops) && r.stops.some((st: any) => (st.stopId?._id || st.stopId || st.id) === sId)
                  );

                  return (
                    <tr key={sId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "700" }}>{s.name}</td>
                      <td style={{ padding: "12px", color: "#64748b" }}>{s.code || "—"}</td>
                      <td style={{ padding: "12px" }}>{s.latitude.toFixed(5)}</td>
                      <td style={{ padding: "12px" }}>{s.longitude.toFixed(5)}</td>
                      <td style={{ padding: "12px" }}>
                        {routesUsingStop.length > 0 ? (
                          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                            {routesUsingStop.map((r: any) => (
                              <span
                                key={r._id || r.id}
                                style={{
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  background: "#f0fdf4",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {r.code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>Unused</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          className="button button-secondary"
                          style={{ padding: "5px 9px", marginRight: "6px", fontSize: "11px" }}
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
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          className="button"
                          style={{ padding: "5px 9px", fontSize: "11px", background: "#fee2e2", color: "#dc2626" }}
                          onClick={() => handleDeleteStop(sId)}
                          title={routesUsingStop.length > 0 ? "Shared by active routes" : "Delete stop"}
                        >
                          <Trash2 size={12} />
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

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                  <th style={{ padding: "12px" }}>Bus</th>
                  <th style={{ padding: "12px" }}>Driver</th>
                  <th style={{ padding: "12px" }}>Route</th>
                  <th style={{ padding: "12px" }}>Live Coordinates</th>
                  <th style={{ padding: "12px" }}>Speed</th>
                  <th style={{ padding: "12px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                      No active trips currently in progress. When drivers start trips, live GPS updates will appear here.
                    </td>
                  </tr>
                ) : (
                  activeTrips.map((t: any) => (
                    <tr key={t._id || t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "700" }}>{t.busId?.busNumber || "Bus"}</td>
                      <td style={{ padding: "12px" }}>{t.driverId?.name || "Driver"}</td>
                      <td style={{ padding: "12px" }}>{t.routeId?.name || "Route"}</td>
                      <td style={{ padding: "12px" }}>
                        {t.currentLocation
                          ? `${t.currentLocation.latitude.toFixed(4)}, ${t.currentLocation.longitude.toFixed(4)}`
                          : "Awaiting Fix"}
                      </td>
                      <td style={{ padding: "12px" }}>{t.currentLocation?.speed ? `${t.currentLocation.speed} km/h` : "—"}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, backgroundColor: "#dcfce7", color: "#166534" }}>
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
        <div className="mobile-scrim" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "14px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ margin: "0 0 16px" }}>{editingItem ? "Edit Bus" : "Add New Bus"}</h3>
            <form onSubmit={handleSaveBus} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Bus Number</label>
                <input
                  required
                  placeholder="e.g. BUS-002"
                  value={busForm.busNumber}
                  onChange={(e) => setBusForm({ ...busForm, busNumber: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Registration Number</label>
                <input
                  required
                  placeholder="e.g. TN10XY9876"
                  value={busForm.registrationNumber}
                  onChange={(e) => setBusForm({ ...busForm, registrationNumber: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Capacity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={busForm.capacity}
                  onChange={(e) => setBusForm({ ...busForm, capacity: parseInt(e.target.value, 10) || 40 })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Save Bus</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Assign Bus Modal */}
      {modalType === "assign-bus" && (
        <div className="mobile-scrim" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "14px", width: "100%", maxWidth: "460px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Assign Route & Driver to Bus</h3>
            {(() => {
              const currentBus = buses.find((b) => (b.id || (b as any)._id) === assignForm.busId);
              const busHasActiveTrip = activeTrips.some(
                (t: any) => (t.busId?._id || t.busId?.id || t.busId) === assignForm.busId
              );

              return (
                <form onSubmit={handleAssignBusSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {busHasActiveTrip && (
                    <div style={{ padding: "10px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", color: "#92400e", fontSize: "12px" }}>
                      ⚠️ Notice: This bus has an active trip in progress. Route cannot be changed until the active trip is completed.
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      Selected Bus: <strong>{currentBus?.busNumber}</strong> ({currentBus?.registrationNumber})
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Assign Route (Multiple buses can share a route)</label>
                    <select
                      value={assignForm.assignedRouteId}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedRouteId: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
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

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Assign Driver</label>
                    <select
                      value={assignForm.assignedDriverId}
                      onChange={(e) => setAssignForm({ ...assignForm, assignedDriverId: e.target.value })}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- No Driver Assigned --</option>
                      {drivers.map((d: any) => (
                        <option key={d._id || d.id} value={d._id || d.id}>
                          {d.name} ({d.collegeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
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
        <div className="mobile-scrim" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "14px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Create Driver Account</h3>
            <form onSubmit={handleSaveDriver} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>College ID</label>
                <input
                  required
                  placeholder="e.g. DRIVER002"
                  value={driverForm.collegeId}
                  onChange={(e) => setDriverForm({ ...driverForm, collegeId: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Driver Name</label>
                <input
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={driverForm.password}
                  onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Create Driver</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add/Edit Stop Modal */}
      {modalType === "stop" && (
        <div className="mobile-scrim" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "14px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ margin: "0 0 16px" }}>{editingItem ? "Edit Stop" : "Add Physical Stop"}</h3>
            <form onSubmit={handleSaveStop} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Stop Name</label>
                <input
                  required
                  placeholder="e.g. Main Gate"
                  value={stopForm.name}
                  onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Stop Code (optional)</label>
                <input
                  placeholder="e.g. STOP-01"
                  value={stopForm.code}
                  onChange={(e) => setStopForm({ ...stopForm, code: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Latitude (-90 to 90)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stopForm.latitude}
                  onChange={(e) => setStopForm({ ...stopForm, latitude: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Longitude (-180 to 180)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stopForm.longitude}
                  onChange={(e) => setStopForm({ ...stopForm, longitude: parseFloat(e.target.value) || 0 })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Landmark / Notes (optional)</label>
                <input
                  placeholder="e.g. Opposite to College Library"
                  value={stopForm.landmark}
                  onChange={(e) => setStopForm({ ...stopForm, landmark: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" className="button button-secondary" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="button button-primary">Save Stop</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Rich Route Builder Modal (Reusable Stops & Sequencing) */}
      {modalType === "route" && (
        <div className="mobile-scrim" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>
                {editingItem ? "Edit Campus Route" : "Create Campus Route with Reusable Stops"}
              </h3>
              <button className="icon-button" onClick={() => setModalType(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Route Name & Code */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Route Name</label>
                  <input
                    required
                    placeholder="e.g. SVCET Main Gate Route"
                    value={routeForm.name}
                    onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Route Code</label>
                  <input
                    required
                    placeholder="e.g. ROUTE-002"
                    value={routeForm.code}
                    onChange={(e) => {
                      setRouteCodeError("");
                      setRouteForm({ ...routeForm, code: e.target.value.toUpperCase() });
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: routeCodeError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                  {routeCodeError && (
                    <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "4px" }}>{routeCodeError}</div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>Description (optional)</label>
                <input
                  placeholder="e.g. Morning express campus route via Main Gate"
                  value={routeForm.description}
                  onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              {/* Identical Sequence Notice */}
              {identicalRouteWarning && (
                <div style={{ padding: "12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "12px", color: "#92400e" }}>
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
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                    Ordered Stops on this Route ({routeForm.stops.length})
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Use arrows to arrange pickup order</span>
                </div>

                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "8px",
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {routeForm.stops.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                      No stops added yet. Select existing stops below or add a new stop.
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
                            background: "#ffffff",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                background: "#2563eb",
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
                              <strong>{stopDetail?.name || "Stop"}</strong>
                              <span style={{ color: "#64748b", marginLeft: "6px", fontSize: "11px" }}>
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
                              title="Move Stop Earlier in Sequence"
                              style={{ padding: "4px", opacity: idx === 0 ? 0.3 : 1 }}
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              disabled={idx === routeForm.stops.length - 1}
                              onClick={() => moveStopDown(idx)}
                              title="Move Stop Later in Sequence"
                              style={{ padding: "4px", opacity: idx === routeForm.stops.length - 1 ? 0.3 : 1 }}
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => removeStopFromRoute(idx)}
                              title="Remove from Route (does not delete stop from database)"
                              style={{ padding: "4px", color: "#dc2626" }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 2: Reusable Existing Stops Selector */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                  Add Existing Campus Stops (Reuses Physical Location)
                </label>
                <div style={{ position: "relative", marginBottom: "8px" }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    placeholder="Search by stop name or code..."
                    value={routeStopSearch}
                    onChange={(e) => setRouteStopSearch(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px 7px 32px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: "130px",
                    overflowY: "auto",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
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
                          background: countInRoute > 0 ? "#eff6ff" : "#ffffff",
                          border: countInRoute > 0 ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      >
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong>{st.name}</strong>
                          {st.code && <span style={{ color: "#64748b", marginLeft: "4px" }}>({st.code})</span>}
                        </div>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: "2px 6px", fontSize: "10px", flexShrink: 0 }}
                          onClick={() => addStopToRoute(stId)}
                        >
                          + Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Quick Add Stop Inline (with duplicate detection) */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
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
                  <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "12px" }}>Register & Add New Stop</strong>
                      <button type="button" className="icon-button" onClick={() => setShowQuickAddStop(false)}>
                        <X size={15} />
                      </button>
                    </div>

                    {proximityWarning && (
                      <div style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "12px", color: "#991b1b", marginBottom: "10px" }}>
                        <div style={{ fontWeight: 700, marginBottom: "4px" }}>⚠️ Proximity / Duplicate Alert</div>
                        <p style={{ margin: "0 0 8px" }}>{proximityWarning.message}</p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
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
                            style={{ padding: "4px 8px", fontSize: "11px" }}
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
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                      <input
                        placeholder="Stop Code (optional)"
                        value={quickStopForm.code}
                        onChange={(e) => setQuickStopForm({ ...quickStopForm, code: e.target.value.toUpperCase() })}
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude"
                        value={quickStopForm.latitude}
                        onChange={(e) => setQuickStopForm({ ...quickStopForm, latitude: parseFloat(e.target.value) || 0 })}
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude"
                        value={quickStopForm.longitude}
                        onChange={(e) => setQuickStopForm({ ...quickStopForm, longitude: parseFloat(e.target.value) || 0 })}
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>

                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => void handleVerifyAndQuickAddStop(false)}
                      style={{ width: "100%", justifyContent: "center", fontSize: "12px", padding: "6px" }}
                    >
                      Verify & Add Stop to Route
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
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
