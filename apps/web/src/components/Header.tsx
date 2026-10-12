import React, { useEffect, useState } from "react";
import { Download, LogOut, Menu, Server, WifiOff } from "lucide-react";
import { ServerConfigModal } from "./ServerConfigModal";
import type { User } from "../types";

interface HeaderProps {
  currentPageTitle: string;
  onOpenMenu: () => void;
  currentUser: User | null;
  onLogout: () => void;
  isSocketConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPageTitle,
  onOpenMenu,
  currentUser,
  onLogout,
  isSocketConnected,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };
  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case "admin":
        return {
          bg: "#fef3c7",
          color: "#92400e",
          border: "#fde68a",
          label: "ADMINISTRATOR",
        };
      case "driver":
        return {
          bg: "#e0f2fe",
          color: "#0369a1",
          border: "#bae6fd",
          label: "CAMPUS DRIVER",
        };
      default:
        return {
          bg: "#ecfdf5",
          color: "#047857",
          border: "#a7f3d0",
          label: "STUDENT",
        };
    }
  };

  const badge = getRoleBadgeStyle(currentUser?.role);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-button"
          aria-label="Open navigation menu"
          onClick={onOpenMenu}
        >
          <Menu size={21} />
        </button>
        <div className="breadcrumb">
          <span>SVCET Campus</span>
          <span className="breadcrumb-divider">/</span>
          <strong>{currentPageTitle}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Real-time Connection Indicator */}
        <div
          className="system-status"
          title={
            isSocketConnected
              ? "Socket.IO real-time telemetry active"
              : "Reconnecting to telemetry socket..."
          }
        >
          <span className={`status-indicator ${isSocketConnected ? "" : "status-offline"}`} />
          <span>{isSocketConnected ? "Live Connected" : "Connecting..."}</span>
        </div>

        {/* PWA Offline Indicator */}
        {!isOnline && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#b45309",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 700,
            }}
            title="You are currently offline. Viewing cached transit information."
          >
            <WifiOff size={13} />
            <span>Offline View</span>
          </div>
        )}

        {/* PWA Install Button (Supported Browsers) */}
        {deferredPrompt && (
          <button
            onClick={handleInstallApp}
            className="button button-primary"
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              gap: "6px",
              background: "#16a34a",
              borderColor: "#15803d",
              color: "#ffffff",
              cursor: "pointer",
            }}
            title="Install SVCET Smart Bus Tracker on your device"
          >
            <Download size={14} />
            <span>Install App</span>
          </button>
        )}

        {/* Direct Android APK Download */}
        <a
          href="/svcet-bus-tracker.apk"
          download="svcet-bus-tracker.apk"
          className="button"
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 700,
            gap: "6px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "8px",
          }}
          title="Download SVCET Android APK (6.9 MB)"
        >
          <Download size={13} />
          <span>Android APK</span>
        </a>

        {/* Server Connection Settings Button */}
        <button
          onClick={() => setIsServerModalOpen(true)}
          className="button"
          style={{
            padding: "6px 11px",
            fontSize: "12px",
            fontWeight: 600,
            gap: "5px",
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "8px",
            background: "#f8fafc",
            border: "1px solid #cbd5e1",
            color: "#334155",
            cursor: "pointer",
          }}
          title="Configure Server API Connection URL"
        >
          <Server size={13} color="#2563eb" />
          <span>Server</span>
        </button>

        {/* Authenticated User Status */}
        {currentUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#1e293b",
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "700",
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{currentUser.name}</span>
                <span style={{ fontSize: "10px", color: "#64748b" }}>{currentUser.collegeId}</span>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: "6px",
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  marginLeft: "4px",
                }}
              >
                {badge.label}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="button button-secondary"
              title="Sign out of account"
              aria-label="Sign out"
              style={{
                padding: "7px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#dc2626",
                borderColor: "#fecaca",
                background: "#fff",
                gap: "6px",
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : null}
      </div>

      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </header>
  );
};

export default Header;
