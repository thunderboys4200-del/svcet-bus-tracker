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
        backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.82) 50%, rgba(30, 58, 138, 0.82) 100%), url("/svcet-building.png")`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.6)",
          padding: "32px 28px",
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
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
              color: "var(--navy-700)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Configure Server API Connection URL"
          >
            <Server size={13} color="#2563eb" />
            <span>Server Settings</span>
          </button>
        </div>

        {/* Branding Header with Official Logo */}
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div
            style={{
              width: "82px",
              height: "82px",
              borderRadius: "50%",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              padding: "3px",
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15), 0 0 0 3px #f59e0b, 0 0 0 6px rgba(245, 158, 11, 0.2)",
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
              color: "var(--navy-900)",
              margin: "0 0 4px",
              letterSpacing: "-0.5px",
            }}
          >
            SVCET Smart Bus Tracker
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--text-muted)",
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
            gap: "4px",
            background: "var(--surface-subtle)",
            padding: "4px",
            borderRadius: "var(--radius-md)",
            marginBottom: "20px",
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
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: activeTab === "login" ? "#ffffff" : "transparent",
              color: activeTab === "login" ? "var(--primary-700)" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: activeTab === "login" ? "var(--shadow-sm)" : "none",
              transition: "all var(--transition-fast)",
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
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: activeTab === "register" ? "#ffffff" : "transparent",
              color: activeTab === "register" ? "var(--primary-700)" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: activeTab === "register" ? "var(--shadow-sm)" : "none",
              transition: "all var(--transition-fast)",
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
              borderRadius: "var(--radius-md)",
              background: "var(--danger-50)",
              border: "1px solid var(--danger-100)",
              color: "var(--danger-700)",
              fontSize: "13px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "18px",
              lineHeight: 1.45,
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
                    background: "var(--danger-600)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "var(--radius-xs)",
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
              borderRadius: "var(--radius-md)",
              background: "var(--success-50)",
              border: "1px solid var(--success-100)",
              color: "var(--success-700)",
              fontSize: "13px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "18px",
              lineHeight: 1.45,
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
                  color: "var(--navy-800)",
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
                    color: "var(--text-light)",
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
                    height: "44px",
                    padding: "0 14px 0 38px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    textTransform: "uppercase",
                    outline: "none",
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
                  color: "var(--navy-800)",
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
                    color: "var(--text-light)",
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
                    height: "44px",
                    padding: "0 40px 0 38px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
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
                    padding: "6px",
                    color: "var(--text-muted)",
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
                height: "46px",
                fontSize: "14px",
                fontWeight: "700",
                marginTop: "4px",
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
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--primary-50)",
                border: "1px solid var(--primary-100)",
                fontSize: "11px",
                color: "var(--primary-800)",
                lineHeight: 1.45,
                display: "flex",
                alignItems: "center",
                gap: "8px",
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
                  color: "var(--navy-800)",
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
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-light)",
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
                    height: "40px",
                    padding: "0 12px 0 36px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
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
                  color: "var(--navy-800)",
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
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-light)",
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
                    height: "40px",
                    padding: "0 12px 0 36px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    textTransform: "uppercase",
                    outline: "none",
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
                    color: "var(--navy-800)",
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
                    height: "40px",
                    padding: "0 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    background: "var(--surface)",
                    outline: "none",
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
                    color: "var(--navy-800)",
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
                    height: "40px",
                    padding: "0 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    background: "var(--surface)",
                    outline: "none",
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
                  color: "var(--navy-800)",
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
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-light)",
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
                    height: "40px",
                    padding: "0 12px 0 36px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
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
                  color: "var(--navy-800)",
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
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-light)",
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
                    height: "40px",
                    padding: "0 38px 0 36px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
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
                    color: "var(--text-muted)",
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
                  color: "var(--navy-800)",
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
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-light)",
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
                    height: "40px",
                    padding: "0 38px 0 36px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none",
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
                    color: "var(--text-muted)",
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
              className="button"
              style={{
                width: "100%",
                height: "46px",
                fontSize: "14px",
                fontWeight: "700",
                marginTop: "4px",
                background: "var(--success-600)",
                color: "#ffffff",
                border: "1px solid var(--success-700)",
                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
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
            background: "var(--success-50)",
            border: "1px solid var(--success-100)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                background: "var(--success-600)",
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
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-700)" }}>
                SVCET Android App (.APK)
              </div>
              <div style={{ fontSize: "11px", color: "var(--success-600)" }}>
                Direct Mobile Install • Production Ready
              </div>
            </div>
          </div>
          <a
            href="/svcet-bus-tracker.apk"
            download="svcet-bus-tracker.apk"
            className="button"
            style={{
              padding: "0 12px",
              minHeight: "34px",
              background: "var(--success-600)",
              color: "#ffffff",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 6px rgba(22, 163, 74, 0.3)",
              whiteSpace: "nowrap",
            }}
          >
            <Download size={13} />
            <span>Download APK</span>
          </a>
        </div>

        {/* Security and Trust Footer */}
        <div
          style={{
            marginTop: "18px",
            paddingTop: "14px",
            borderTop: "1px solid var(--surface-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <ShieldCheck size={15} color="#16a34a" />
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
