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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return {
          bg: "#fef3c7",
          color: "#92400e",
          border: "#fde68a",
          label: "ADMIN",
        };
      case "driver":
        return {
          bg: "#e0f2fe",
          color: "#0369a1",
          border: "#bae6fd",
          label: "DRIVER",
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

  const badge = getRoleBadge(currentUser?.role);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-button"
          aria-label="Open navigation menu"
          onClick={onOpenMenu}
        >
          <Menu size={22} />
        </button>
        <div className="breadcrumb">
          <span>SVCET Campus</span>
          <span className="breadcrumb-divider">/</span>
          <strong>{currentPageTitle}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Real-time Telemetry Pulse Indicator */}
        <div
          className="system-status"
          title={
            isSocketConnected
              ? "Socket.IO real-time telemetry active"
              : "Connecting to telemetry socket..."
          }
        >
          <span className={`status-indicator ${isSocketConnected ? "" : "status-offline"}`} />
          <span>{isSocketConnected ? "Live Connected" : "Connecting..."}</span>
        </div>

        {/* Offline Badge */}
        {!isOnline && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#b45309",
              borderRadius: "var(--radius-full)",
              fontSize: "11px",
              fontWeight: 700,
            }}
            title="You are currently offline. Viewing cached transit information."
          >
            <WifiOff size={13} />
            <span>Offline</span>
          </div>
        )}

        {/* PWA Install Button */}
        {deferredPrompt && (
          <button
            onClick={handleInstallApp}
            className="button"
            style={{
              padding: "0 12px",
              minHeight: "36px",
              fontSize: "12px",
              fontWeight: 700,
              gap: "6px",
              background: "#16a34a",
              color: "#ffffff",
              border: "1px solid #15803d",
              borderRadius: "var(--radius-md)",
            }}
            title="Install SVCET Smart Bus Tracker on your home screen"
          >
            <Download size={14} />
            <span>Install</span>
          </button>
        )}

        {/* Direct Android APK Download */}
        <a
          href="/svcet-bus-tracker.apk"
          download="svcet-bus-tracker.apk"
          className="button"
          style={{
            padding: "0 12px",
            minHeight: "36px",
            fontSize: "12px",
            fontWeight: 700,
            gap: "6px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
          }}
          title="Download SVCET Android App (.APK)"
        >
          <Download size={13} />
          <span>APK</span>
        </a>

        {/* Server Connection Settings Button */}
        <button
          onClick={() => setIsServerModalOpen(true)}
          className="button button-secondary"
          style={{
            padding: "0 11px",
            minHeight: "36px",
            fontSize: "12px",
            fontWeight: 600,
            gap: "5px",
            borderRadius: "var(--radius-md)",
          }}
          title="Configure API Connection URL"
          aria-label="Server settings"
        >
          <Server size={13} color="#2563eb" />
          <span>Server</span>
        </button>

        {/* Authenticated User Status Pill */}
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px 4px 6px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-full)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary-600), var(--primary-700))",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
                }}
              >
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--navy-900)",
                    maxWidth: "110px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentUser.name}
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {currentUser.collegeId}
                </span>
              </div>

              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-full)",
                  background: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
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
                padding: "0 10px",
                minHeight: "36px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--danger-600)",
                borderColor: "var(--danger-100)",
                borderRadius: "var(--radius-md)",
                gap: "5px",
              }}
            >
              <LogOut size={13} />
              <span>Exit</span>
            </button>
          </div>
        )}
      </div>

      <ServerConfigModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
      />
    </header>
  );
};

export default Header;
