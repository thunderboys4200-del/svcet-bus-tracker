import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { StudentDashboard } from "./pages/StudentDashboard";
import { DriverDashboard } from "./pages/DriverDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import {
  api,
  clearStoredAuth,
  getStoredToken,
  getStoredUser,
} from "./services/api";
import { disconnectSocket, getSocket } from "./services/socket";
import type { Role, User } from "./types";
import "./index.css";
import "./App.css";

const CURRENT_YEAR = new Date().getFullYear();

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser());
  const [activePage, setActivePage] = useState<string>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [sessionChecking, setSessionChecking] = useState<boolean>(true);

  // Validate existing stored token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.auth
        .getMe()
        .then((res) => {
          if (res.user) {
            setCurrentUser(res.user);
          } else {
            clearStoredAuth();
            setCurrentUser(null);
          }
        })
        .catch(() => {
          clearStoredAuth();
          setCurrentUser(null);
        })
        .finally(() => {
          setSessionChecking(false);
        });
    } else {
      setSessionChecking(false);
    }
  }, []);

  // Socket.IO lifecycle
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    if (socket.connected) {
      setIsSocketConnected(true);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const handleLoginSuccess = (user: User, _token: string) => {
    setCurrentUser(user);
    setActivePage("dashboard");
  };

  const handleLogout = () => {
    clearStoredAuth();
    setCurrentUser(null);
    setActivePage("dashboard");
    disconnectSocket();
  };

  if (sessionChecking) {
    return (
      <div className="loading-indicator" aria-live="polite">
        <span className="loading-spinner" />
        Initializing SVCET Campus Transport Portal…
      </div>
    );
  }

  // If unauthenticated, render the dedicated real Login page
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const role: Role = currentUser.role;

  const getPageTitle = () => {
    if (role === "admin") return "Administrator Fleet Console";
    if (role === "driver") return "Driver Fleet Operations";
    return "Student Bus Portal";
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeRole={role}
        activePage={activePage}
        onSelectPage={(pageId) => setActivePage(pageId)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="main-area">
        <Header
          currentPageTitle={getPageTitle()}
          onOpenMenu={() => setSidebarOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          isSocketConnected={isSocketConnected}
        />

        {/* Strictly Authenticated Role Dashboards */}
        {role === "admin" && <AdminDashboard activePage={activePage} />}
        {role === "driver" && <DriverDashboard />}
        {role === "student" && <StudentDashboard activePage={activePage} />}

        <footer className="page-footer">
          <span>© {CURRENT_YEAR} Sri Venkateswara College of Engineering and Technology (SVCET)</span>
          <span>Integrated Campus Fleet Management & Real-Time GPS Tracking</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
