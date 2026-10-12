import React, { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  LogIn,
  Phone,
  Server,
  Settings,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { api } from "../services/api";
import { ServerConfigModal } from "../components/ServerConfigModal";
import type { User as UserType } from "../types";

interface LoginProps {
  onLoginSuccess: (user: UserType, token: string) => void;
}

const DEPARTMENTS = [
  "Computer Science & Engineering (CSE)",
  "Electronics & Communication Engineering (ECE)",
  "Electrical & Electronics Engineering (EEE)",
  "Mechanical Engineering (MECH)",
  "Civil Engineering (CIVIL)",
  "Information Technology (IT)",
  "Artificial Intelligence & Data Science (AI & DS)",
  "Master of Business Administration (MBA)",
  "Master of Computer Applications (MCA)",
];

const YEARS = [
  "1st Year (Semester 1 & 2)",
  "2nd Year (Semester 3 & 4)",
  "3rd Year (Semester 5 & 6)",
  "4th Year (Semester 7 & 8)",
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration form state (Students Only)
  const [regName, setRegName] = useState("");
  const [regCollegeId, setRegCollegeId] = useState("");
  const [regDepartment, setRegDepartment] = useState(DEPARTMENTS[0]);
  const [regYear, setRegYear] = useState(YEARS[0]);
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Status and feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const identifier = loginIdentifier.trim().toUpperCase();
    if (!identifier) {
      setError("Please enter your College ID or username.");
      return;
    }
    if (!loginPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.auth.login(identifier, loginPassword);
      onLoginSuccess(response.user, response.token);
    } catch (err: any) {
      setError(
        err.message ||
          "Authentication failed. Please verify your credentials or check if your account is active.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // Client-side validations
    if (!regName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    const cleanCollegeId = regCollegeId.trim().toUpperCase();
    if (!cleanCollegeId || cleanCollegeId.length < 3) {
      setError("Please enter a valid College ID (at least 3 characters).");
      return;
    }
    if (regPhone) {
      const phoneDigits = regPhone.replace(/\D/g, "");
      if (phoneDigits.length !== 10) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }
    }
    if (regPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match. Please re-enter your password confirmation.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.auth.registerStudent({
        name: regName.trim(),
        collegeId: cleanCollegeId,
        department: regDepartment,
        year: regYear,
        phone: regPhone.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });

      setSuccessMessage(
        "Student account created successfully! Signing in to your student portal...",
      );
      // Automatically log student in
      setTimeout(() => {
        onLoginSuccess(response.user, response.token);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.88) 50%, rgba(30, 58, 138, 0.85) 100%), url("/svcet-building.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "490px",
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: "24px",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.4)",
          padding: "36px 32px",
          boxSizing: "border-box",
        }}
      >
        {/* Card Top: Server Connection Settings Toggle */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button
            type="button"
            onClick={() => setIsServerModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Configure Server API Connection URL"
          >
            <Server size={13} color="#2563eb" />
            <span>Server Settings</span>
          </button>
        </div>

        {/* College & Project Branding Header with Official Logo */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              padding: "4px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2), 0 0 0 3px #f59e0b, 0 0 0 6px rgba(245, 158, 11, 0.25)",
              boxSizing: "border-box",
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
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: "#0f172a",
              margin: "0 0 6px",
              letterSpacing: "-0.5px",
            }}
          >
            SVCET Smart Bus Tracker
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            Sri Venkateswara College of Engineering & Technology
          </p>
        </div>

        {/* Tab Switching: Sign In vs Create Student Account */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            background: "#f1f5f9",
            padding: "5px",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              setError("");
              setSuccessMessage("");
            }}
            style={{
              padding: "10px",
              borderRadius: "9px",
              border: "none",
              background: activeTab === "login" ? "#ffffff" : "transparent",
              color: activeTab === "login" ? "#1e3a8a" : "#64748b",
              fontWeight: 700,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: activeTab === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setError("");
              setSuccessMessage("");
            }}
            style={{
              padding: "10px",
              borderRadius: "9px",
              border: "none",
              background: activeTab === "register" ? "#ffffff" : "transparent",
              color: activeTab === "register" ? "#1e3a8a" : "#64748b",
              fontWeight: 700,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: activeTab === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <UserPlus size={15} />
            <span>Student Register</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: "13px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "20px",
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>{error}</span>
            </div>
            {(error.includes("connect") || error.includes("port 4000") || error.includes("network") || error.includes("Server")) && (
              <div style={{ paddingLeft: "28px" }}>
                <button
                  type="button"
                  onClick={() => setIsServerModalOpen(true)}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Settings size={13} />
                  <span>Configure Server Connection / Change IP</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div
            role="status"
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#15803d",
              fontSize: "13px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "20px",
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* -------------------- TAB 1: SIGN IN -------------------- */}
        {activeTab === "login" && (
          <form
            onSubmit={handleLoginSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div>
              <label
                htmlFor="login-identifier"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                College ID or Username
              </label>
              <div style={{ position: "relative" }}>
                <UserIcon
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. GOKUL, STUDENT001, DRIVER001"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value.toUpperCase())}
                  style={{
                    width: "100%",
                    padding: "11px 12px 11px 36px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    textTransform: "uppercase",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  required
                  placeholder="Enter your account password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 40px 11px 36px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  title={showLoginPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "4px",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button button-primary"
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "8px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              }}
            >
              {loading ? (
                <span>Authenticating with MongoDB...</span>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Sign In to Fleet Portal</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* -------------------- TAB 2: STUDENT REGISTRATION -------------------- */}
        {activeTab === "register" && (
          <form
            onSubmit={handleRegisterSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {/* Role scope restriction notice */}
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                fontSize: "11px",
                color: "#1e40af",
                lineHeight: 1.4,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <GraduationCap size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Student Self-Registration:</strong> Staff & driver credentials are provisioned by college administration.
              </span>
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="reg-name"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Full Name *
              </label>
              <div style={{ position: "relative" }}>
                <UserIcon
                  size={15}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="reg-name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* College ID */}
            <div>
              <label
                htmlFor="reg-college-id"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                College ID / Roll Number *
              </label>
              <div style={{ position: "relative" }}>
                <BookOpen
                  size={15}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="reg-college-id"
                  type="text"
                  required
                  placeholder="e.g. 21SVCET045"
                  value={regCollegeId}
                  onChange={(e) => setRegCollegeId(e.target.value.toUpperCase())}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    textTransform: "uppercase",
                  }}
                />
              </div>
            </div>

            {/* Department & Year (Grid) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label
                  htmlFor="reg-department"
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  Department
                </label>
                <select
                  id="reg-department"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 8px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="reg-year"
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  Academic Year
                </label>
                <select
                  id="reg-year"
                  value={regYear}
                  onChange={(e) => setRegYear(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 8px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label
                htmlFor="reg-phone"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Mobile Number
              </label>
              <div style={{ position: "relative" }}>
                <Phone
                  size={15}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="e.g. 9876543210 (10 digits)"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="reg-password"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Password (min 8 characters) *
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="reg-password"
                  type={showRegPassword ? "text" : "password"}
                  required
                  placeholder="Create strong password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "4px",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="reg-confirm-password"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "4px",
                }}
              >
                Confirm Password *
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
                <input
                  id="reg-confirm-password"
                  type={showRegConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 36px 9px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  aria-label={showRegConfirmPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "4px",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {showRegConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Register Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="button button-primary"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "6px",
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
              }}
            >
              {loading ? (
                <span>Registering student account...</span>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Student Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Android App Download Banner */}
        <div
          style={{
            marginTop: "20px",
            padding: "12px 14px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              📱
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#166534" }}>
                SVCET Android App (.APK)
              </div>
              <div style={{ fontSize: "11px", color: "#15803d" }}>
                Direct Mobile Install • 6.9 MB
              </div>
            </div>
          </div>
          <a
            href="/svcet-bus-tracker.apk"
            download="svcet-bus-tracker.apk"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              background: "#16a34a",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 6px rgba(22, 163, 74, 0.3)",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={14} />
            <span>Download APK</span>
          </a>
        </div>

        {/* Security and Trust Footer */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <ShieldCheck size={16} color="#15803d" />
          <span>MongoDB Atlas Authentication • JWT Session</span>
        </div>

        {/* Server Connection Modal */}
        <ServerConfigModal
          isOpen={isServerModalOpen}
          onClose={() => setIsServerModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default Login;
