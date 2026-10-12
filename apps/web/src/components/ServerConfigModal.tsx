import React, { useState } from "react";
import {
  CheckCircle2,
  Globe,
  Radio,
  RefreshCw,
  Server,
  Smartphone,
  Wifi,
  X,
} from "lucide-react";
import {
  getApiBaseUrl,
  getApiConfigInfo,
  LOCAL_LAN_API_FALLBACK,
  resetCustomApiBaseUrl,
  setCustomApiBaseUrl,
  validateApiUrl,
} from "../config/api.config";

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const currentConfig = getApiConfigInfo();
  const [inputUrl, setInputUrl] = useState(currentConfig.url);
  const [testingStatus, setTestingStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResultMsg, setTestResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setErrorMsg("");
    setTestingStatus("testing");
    setTestResultMsg("Pinging server health endpoint...");

    const { valid, error } = validateApiUrl(inputUrl);
    if (!valid) {
      setTestingStatus("error");
      setErrorMsg(error || "Invalid URL format.");
      return;
    }

    const clean = inputUrl.trim().replace(/\/+$/, "");
    const healthUrl = `${clean}/api/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestingStatus("success");
        setTestResultMsg(
          `✓ Connected! Server responded: ${data.service || "SVCET API"} (DB: ${data.database || "connected"})`,
        );
      } else {
        setTestingStatus("error");
        setTestResultMsg(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      setTestingStatus("error");
      if (err.name === "AbortError") {
        setTestResultMsg("Connection timed out (6s). Check if your server or computer is reachable from this device.");
      } else {
        setTestResultMsg(`Connection failed: ${err.message || "Network request failed"}`);
      }
    }
  };

  const handleSave = () => {
    setErrorMsg("");
    const res = setCustomApiBaseUrl(inputUrl);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to save URL.");
      return;
    }
    if (onSaved) {
      onSaved();
    }
    onClose();
  };

  const handleReset = () => {
    resetCustomApiBaseUrl();
    const def = getApiBaseUrl();
    setInputUrl(def);
    setTestingStatus("idle");
    setTestResultMsg("");
    setErrorMsg("");
    if (onSaved) {
      onSaved();
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 20px",
            background: "#1e3a8a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Server size={20} color="#93c5fd" />
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>Server Connection Settings</div>
              <div style={{ fontSize: "11px", color: "#bfdbfe" }}>
                Configure SVCET bus tracker API endpoint
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px" }}>
          {/* Platform Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "#f1f5f9",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#334155",
              marginBottom: "16px",
            }}
          >
            {currentConfig.isNative ? (
              <>
                <Smartphone size={15} color="#2563eb" />
                <span>
                  <strong>Android APK Mode:</strong> Requires a network IP or cloud URL (localhost points to phone).
                </span>
              </>
            ) : (
              <>
                <Globe size={15} color="#059669" />
                <span>
                  <strong>Web Browser Mode:</strong> Running on {window.location.host}
                </span>
              </>
            )}
          </div>

          {/* Warning Message if any */}
          {currentConfig.warning && (
            <div
              style={{
                padding: "8px 12px",
                background: "#fffbeb",
                border: "1px solid #fef08a",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#854d0e",
                marginBottom: "16px",
              }}
            >
              ⚠️ {currentConfig.warning}
            </div>
          )}

          {/* URL Input */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#1e293b",
                marginBottom: "6px",
              }}
            >
              API Base URL
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestingStatus("idle");
                setTestResultMsg("");
              }}
              placeholder="https://your-api.onrender.com or http://10.x.x.x:4000"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "13px",
                fontFamily: "monospace",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            {errorMsg && (
              <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "4px" }}>
                {errorMsg}
              </div>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "8px", textTransform: "uppercase" }}>
              Quick Presets
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <button
                type="button"
                onClick={() => {
                  setInputUrl(LOCAL_LAN_API_FALLBACK);
                  setTestingStatus("idle");
                  setTestResultMsg("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Wifi size={14} color="#2563eb" />
                  <span>Computer Wi-Fi IP (for phone on same Wi-Fi)</span>
                </div>
                <code style={{ fontSize: "11px", color: "#2563eb" }}>{LOCAL_LAN_API_FALLBACK}</code>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputUrl("https://svcet-bus-tracker-api.onrender.com");
                  setTestingStatus("idle");
                  setTestResultMsg("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio size={14} color="#7c3aed" />
                  <span>Render Cloud API Example</span>
                </div>
                <code style={{ fontSize: "11px", color: "#7c3aed" }}>https://*.onrender.com</code>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputUrl("http://localhost:4000");
                  setTestingStatus("idle");
                  setTestResultMsg("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Server size={14} color="#475569" />
                  <span>Localhost (PC Browser only)</span>
                </div>
                <code style={{ fontSize: "11px", color: "#475569" }}>http://localhost:4000</code>
              </button>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div style={{ marginBottom: "20px" }}>
            <button
              type="button"
              disabled={testingStatus === "testing"}
              onClick={handleTestConnection}
              style={{
                width: "100%",
                padding: "9px 14px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#1e293b",
                cursor: testingStatus === "testing" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <RefreshCw size={14} className={testingStatus === "testing" ? "animate-spin" : ""} />
              <span>{testingStatus === "testing" ? "Pinging Server..." : "Test Connection"}</span>
            </button>

            {testResultMsg && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                  background: testingStatus === "success" ? "#f0fdf4" : "#fef2f2",
                  color: testingStatus === "success" ? "#166534" : "#991b1b",
                  border: `1px solid ${testingStatus === "success" ? "#bbf7d0" : "#fecaca"}`,
                }}
              >
                {testingStatus === "success" && <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: "1px" }} />}
                <span>{testResultMsg}</span>
              </div>
            )}
          </div>

          {/* Modal Action Buttons */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "9px 14px",
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Reset Default
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: "9px 18px",
                background: "#16a34a",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(22, 163, 74, 0.3)",
              }}
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
