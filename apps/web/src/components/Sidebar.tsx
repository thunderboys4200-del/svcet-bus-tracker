import React from "react";
import {
  Bell,
  BusFront,
  History,
  LayoutDashboard,
  LogOut,
  Navigation,
  Route as RouteIcon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Role, User } from "../types";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: string | number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeRole: Role;
  activePage: string;
  onSelectPage: (pageId: string) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeRole,
  activePage,
  onSelectPage,
  currentUser,
  onLogout,
}) => {
  // Navigation items based on role
  const getNavItems = (): NavItem[] => {
    if (activeRole === "admin") {
      return [
        { id: "dashboard", label: "Fleet Overview", icon: LayoutDashboard },
        { id: "buses", label: "Manage Buses", icon: BusFront },
        { id: "drivers", label: "Manage Drivers", icon: Users },
        { id: "routes", label: "Routes & Stops", icon: RouteIcon },
        { id: "fleet-map", label: "Active Trips Live", icon: Navigation },
      ];
    }

    if (activeRole === "driver") {
      return [
        { id: "trip-console", label: "Trip & GPS Console", icon: Navigation },
        { id: "my-bus", label: "Assigned Bus & Route", icon: BusFront },
        { id: "history", label: "Trip History", icon: History },
      ];
    }

    // Default: Student Portal
    return [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "tracking", label: "Live Bus Tracking", icon: Navigation },
      { id: "routes", label: "Routes & Stops", icon: RouteIcon },
      { id: "notifications", label: "Service Updates", icon: Bell },
    ];
  };

  const navItems = getNavItems();

  return (
    <>
      {isOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        {/* Brand */}
        <div className="brand">
          <div
            className="brand-logo"
            style={{
              background: "#ffffff",
              padding: "2px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #f59e0b",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/svcet-logo.png"
              alt="SVCET College Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: "50%",
              }}
            />
          </div>
          <div className="brand-copy">
            <strong>SVCET</strong>
            <span>SMART BUS TRACKER</span>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        {/* Campus Transport Chip */}
        <div className="campus-chip">
          <span className="campus-chip-dot" />
          <span>
            {activeRole === "admin"
              ? "Admin Control Center"
              : activeRole === "driver"
                ? "Driver Fleet Portal"
                : "Campus Student Transport"}
          </span>
        </div>

        {/* Section Label */}
        <div className="sidebar-section-label">WORKSPACE</div>

        {/* Navigation links */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? "nav-item-active" : ""}`}
              onClick={() => {
                onSelectPage(id);
                onClose();
              }}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
              {badge !== undefined && (
                <span className="nav-alert-dot" style={{ background: "#2563eb", color: "#fff", padding: "1px 6px", fontSize: "10px", borderRadius: "10px", height: "auto", width: "auto" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Support & Profile */}
        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>SVCET Transport</strong>
            <p>Sri Venkateswara College of Engineering and Technology</p>
          </div>

          <div className="sidebar-profile">
            <div className="profile-avatar">
              {currentUser ? currentUser.name.charAt(0).toUpperCase() : activeRole.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{currentUser ? currentUser.name : "User"}</strong>
              <span>{currentUser ? `${currentUser.collegeId} (${currentUser.role})` : ""}</span>
            </div>
            {currentUser && (
              <button
                className="icon-button"
                onClick={onLogout}
                title="Log out"
                style={{ padding: "4px" }}
              >
                <LogOut size={17} className="profile-logout-icon" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
