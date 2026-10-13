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
          `Connected! Server: ${data.service || "SVCET API"} (DB: ${data.database || "connected"})`,
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-50)",
                color: "var(--primary-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Server size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--navy-900)" }}>
                Server Connection Settings
              </h3>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
                Configure SVCET Bus Tracker API backend
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Platform Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
              color: "var(--navy-800)",
              marginBottom: "16px",
              border: "1px solid var(--border)",
            }}
          >
            {currentConfig.isNative ? (
              <>
                <Smartphone size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Android APK Mode:</strong> Requires a network IP or cloud URL (localhost points to your phone).
                </span>
              </>
            ) : (
              <>
                <Globe size={16} color="#059669" style={{ flexShrink: 0 }} />
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
                padding: "10px 14px",
                background: "var(--warning-50)",
                border: "1px solid var(--warning-100)",
                borderRadius: "var(--radius-md)",
                fontSize: "11px",
                color: "var(--warning-700)",
                marginBottom: "16px",
              }}
            >
              ⚠️ {currentConfig.warning}
            </div>
          )}

          {/* URL Input */}
          <div className="form-group">
            <label htmlFor="api-endpoint-input">API Base URL</label>
            <input
              id="api-endpoint-input"
              type="text"
              className="form-input"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setTestingStatus("idle");
                setTestResultMsg("");
              }}
              placeholder="https://your-api.onrender.com or http://10.x.x.x:4000"
              style={{ fontFamily: "monospace", fontSize: "12px" }}
            />
            {errorMsg && (
              <div style={{ color: "var(--danger-600)", fontSize: "11px", marginTop: "4px" }}>
                {errorMsg}
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>
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
                  padding: "10px 14px",
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Wifi size={14} color="#2563eb" />
                  <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>Computer Wi-Fi IP</span>
                </div>
                <code style={{ fontSize: "11px", color: "var(--primary-600)" }}>{LOCAL_LAN_API_FALLBACK}</code>
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
                  padding: "10px 14px",
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Radio size={14} color="#7c3aed" />
                  <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>Render Cloud Backend</span>
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
                  padding: "10px 14px",
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Server size={14} color="#475569" />
                  <span style={{ fontWeight: 600, color: "var(--navy-900)" }}>Localhost (Browser only)</span>
                </div>
                <code style={{ fontSize: "11px", color: "#475569" }}>http://localhost:4000</code>
              </button>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div style={{ marginBottom: "8px" }}>
            <button
              type="button"
              disabled={testingStatus === "testing"}
              onClick={handleTestConnection}
              className="button button-secondary"
              style={{
                width: "100%",
                minHeight: "40px",
                fontWeight: 700,
              }}
            >
              <RefreshCw size={14} className={testingStatus === "testing" ? "spin" : ""} />
              <span>{testingStatus === "testing" ? "Pinging Server..." : "Test Connection"}</span>
            </button>

            {testResultMsg && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  background: testingStatus === "success" ? "var(--success-50)" : "var(--danger-50)",
                  color: testingStatus === "success" ? "var(--success-700)" : "var(--danger-700)",
                  border: `1px solid ${testingStatus === "success" ? "var(--success-100)" : "var(--danger-100)"}`,
                }}
              >
                {testingStatus === "success" && (
                  <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: "1px" }} />
                )}
                <span>{testResultMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={handleReset}
            className="button button-secondary"
          >
            Reset Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="button button-primary"
            style={{ fontWeight: 700 }}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerConfigModal;
