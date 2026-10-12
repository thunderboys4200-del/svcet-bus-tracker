import {
  getApiBaseUrl,
  getApiConfigInfo,
  setCustomApiBaseUrl,
  resetCustomApiBaseUrl,
  validateApiUrl,
} from "../config/api.config";
import type { Bus, FleetStats, Route, Stop, TrackingData, Trip, User } from "../types";

export const API_BASE = getApiBaseUrl();

export {
  getApiBaseUrl,
  getApiConfigInfo,
  setCustomApiBaseUrl,
  resetCustomApiBaseUrl,
  validateApiUrl,
};

const TOKEN_KEY = "svcet_auth_token";
const USER_KEY = "svcet_auth_user";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in private mode
  }
}

export function clearStoredAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = getApiBaseUrl();
  const url = `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    console.error(`[API Connection Error] Failed to reach ${url}:`, err);
    throw new Error(
      `Unable to connect to the SVCET bus tracking server at ${base}. Please verify that the API server is online and accessible.`,
    );
  }

  if (response.status === 401) {
    clearStoredAuth();
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const message =
      json?.message ||
      json?.error ||
      `Request failed with HTTP status ${response.status}`;
    const err: any = new Error(message);
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return json;
}

export const api = {
  // Auth
  auth: {
    async login(identifier: string, password: string): Promise<{ token: string; user: User }> {
      const data = await request<{ success?: boolean; token: string; user: User }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ identifier, password }),
        },
      );
      setStoredToken(data.token);
      setStoredUser(data.user);
      return data;
    },

    async getMe(): Promise<{ success: boolean; user: User }> {
      const data = await request<{ success: boolean; user: User }>("/api/auth/me");
      if (data.user) {
        setStoredUser(data.user);
      }
      return data;
    },

    async registerStudent(params: {
      collegeId: string;
      name: string;
      password: string;
      confirmPassword?: string;
      department?: string;
      year?: string;
      phone?: string;
    }): Promise<{ token: string; user: User }> {
      const data = await request<{ token: string; user: User }>(
        "/api/auth/register-student",
        {
          method: "POST",
          body: JSON.stringify(params),
        },
      );
      setStoredToken(data.token);
      setStoredUser(data.user);
      return data;
    },
  },

  // Public / Student Trips
  trips: {
    async getBuses(): Promise<{ success: boolean; data: Bus[] }> {
      return request<{ success: boolean; data: Bus[] }>("/api/trips/buses");
    },

    async getActiveTrips(): Promise<{ success: boolean; data: any[] }> {
      return request<{ success: boolean; data: any[] }>("/api/trips/active");
    },

    async getRoutes(): Promise<{ success: boolean; data: Route[] }> {
      return request<{ success: boolean; data: Route[] }>("/api/trips/routes");
    },

    async getBusTracking(busId: string): Promise<{ success: boolean; data: TrackingData }> {
      return request<{ success: boolean; data: TrackingData }>(
        `/api/trips/bus/${busId}/tracking`,
      );
    },

    // Driver Operations
    async getDriverAssigned(): Promise<{
      success: boolean;
      data: { bus: Bus; route: Route } | null;
      message?: string;
    }> {
      return request<{
        success: boolean;
        data: { bus: Bus; route: Route } | null;
        message?: string;
      }>("/api/trips/driver/assigned");
    },

    async getDriverActive(): Promise<{ success: boolean; data: Trip | null }> {
      return request<{ success: boolean; data: Trip | null }>("/api/trips/driver/active");
    },

    async startTrip(busId: string): Promise<{ success: boolean; data: any; message: string }> {
      return request<{ success: boolean; data: any; message: string }>("/api/trips/start", {
        method: "POST",
        body: JSON.stringify({ busId }),
      });
    },

    async updateLocation(
      tripId: string,
      location: {
        latitude: number;
        longitude: number;
        accuracy?: number;
        heading?: number;
        speed?: number;
        recordedAt?: string;
      },
    ): Promise<{ success: boolean; data: any }> {
      return request<{ success: boolean; data: any }>(
        `/api/trips/${tripId}/location`,
        {
          method: "POST",
          body: JSON.stringify(location),
        },
      );
    },

    async endTrip(tripId: string): Promise<{ success: boolean; data: Trip; message: string }> {
      return request<{ success: boolean; data: Trip; message: string }>(
        `/api/trips/${tripId}/end`,
        {
          method: "POST",
        },
      );
    },

    async getHistory(page = 1, limit = 10): Promise<{ success: boolean; data: Trip[]; pagination: any }> {
      return request<{ success: boolean; data: Trip[]; pagination: any }>(
        `/api/trips/history?page=${page}&limit=${limit}`,
      );
    },
  },

  // Administrator Operations
  admin: {
    async getDashboard(): Promise<{ success: boolean; data: FleetStats }> {
      return request<{ success: boolean; data: FleetStats }>("/api/admin/dashboard");
    },

    // Buses
    async getBuses(): Promise<{ success: boolean; data: Bus[] }> {
      return request<{ success: boolean; data: Bus[] }>("/api/admin/buses");
    },

    async createBus(payload: {
      busNumber: string;
      registrationNumber: string;
      capacity: number;
      assignedDriverId?: string;
      assignedRouteId?: string;
    }): Promise<{ success: boolean; data: Bus; message: string }> {
      return request<{ success: boolean; data: Bus; message: string }>("/api/admin/buses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async updateBus(
      busId: string,
      payload: Partial<Bus>,
    ): Promise<{ success: boolean; data: Bus; message: string }> {
      return request<{ success: boolean; data: Bus; message: string }>(
        `/api/admin/buses/${busId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },

    async deleteBus(busId: string): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>(
        `/api/admin/buses/${busId}`,
        {
          method: "DELETE",
        },
      );
    },

    async assignBus(
      busId: string,
      assignedRouteId?: string,
      assignedDriverId?: string,
    ): Promise<{ success: boolean; data: Bus; message: string }> {
      return request<{ success: boolean; data: Bus; message: string }>(
        `/api/admin/buses/${busId}/assign`,
        {
          method: "POST",
          body: JSON.stringify({ assignedRouteId, assignedDriverId }),
        },
      );
    },

    // Stops
    async getStops(): Promise<{ success: boolean; data: Stop[] }> {
      return request<{ success: boolean; data: Stop[] }>("/api/admin/stops");
    },

    async createStop(payload: {
      name: string;
      latitude: number;
      longitude: number;
      code?: string;
      address?: string;
      landmark?: string;
      confirmDuplicate?: boolean;
    }): Promise<{ success: boolean; data: Stop; message: string; duplicateWarning?: boolean; existingStop?: any; distanceMeters?: number }> {
      return request<any>("/api/admin/stops", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async updateStop(
      stopId: string,
      payload: Partial<Stop>,
    ): Promise<{ success: boolean; data: Stop; message: string }> {
      return request<{ success: boolean; data: Stop; message: string }>(
        `/api/admin/stops/${stopId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },

    async deleteStop(stopId: string): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>(
        `/api/admin/stops/${stopId}`,
        {
          method: "DELETE",
        },
      );
    },

    // Routes
    async getRoutes(): Promise<{ success: boolean; data: Route[] }> {
      return request<{ success: boolean; data: Route[] }>("/api/admin/routes");
    },

    async createRoute(payload: {
      name: string;
      code: string;
      description?: string;
      stops: Array<{ stopId: string; sequence: number }>;
      geometry?: [number, number][];
      confirmIdenticalSequence?: boolean;
    }): Promise<{ success: boolean; data: Route; message: string; identicalSequenceWarning?: boolean; existingRoute?: any }> {
      return request<any>("/api/admin/routes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async updateRoute(
      routeId: string,
      payload: Partial<Route>,
    ): Promise<{ success: boolean; data: Route; message: string }> {
      return request<{ success: boolean; data: Route; message: string }>(
        `/api/admin/routes/${routeId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },

    async deleteRoute(routeId: string): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>(
        `/api/admin/routes/${routeId}`,
        {
          method: "DELETE",
        },
      );
    },

    // Drivers
    async getDrivers(): Promise<{ success: boolean; data: User[] }> {
      return request<{ success: boolean; data: User[] }>("/api/admin/drivers");
    },

    async createDriver(payload: {
      collegeId: string;
      name: string;
      password: string;
    }): Promise<{ success: boolean; data: any; message: string }> {
      return request<{ success: boolean; data: any; message: string }>(
        "/api/admin/drivers",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
    },

    async updateDriverStatus(
      driverId: string,
      active: boolean,
    ): Promise<{ success: boolean; data: any; message: string }> {
      return request<{ success: boolean; data: any; message: string }>(
        `/api/admin/drivers/${driverId}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ active }),
        },
      );
    },

    async deleteDriver(driverId: string): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>(
        `/api/admin/drivers/${driverId}`,
        {
          method: "DELETE",
        },
      );
    },

    // Active Trips Fleet Overview
    async getActiveTrips(): Promise<{ success: boolean; count: number; data: any[] }> {
      return request<{ success: boolean; count: number; data: any[] }>(
        "/api/admin/trips/active",
      );
    },
  },
};
