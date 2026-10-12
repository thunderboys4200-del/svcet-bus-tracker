export type Role = "student" | "driver" | "admin";

export interface User {
  id: string;
  collegeId: string;
  username?: string;
  name: string;
  role: Role;
  department?: string;
  year?: string;
  phone?: string;
  assignedBusId?: string;
  assignedRouteId?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  recordedAt?: string;
}

export interface Stop {
  id?: string;
  _id?: string;
  name: string;
  code?: string;
  address?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  sequence?: number;
  active?: boolean;
}

export interface RouteStop {
  stopId?: Stop | string;
  sequence: number;
}

export interface Route {
  id?: string;
  _id?: string;
  name: string;
  code: string;
  description?: string;
  stops?: Stop[] | RouteStop[];
  geometry?: [number, number][];
  active?: boolean;
}

export interface Bus {
  id?: string;
  _id?: string;
  busNumber: string;
  registrationNumber: string;
  capacity?: number;
  assignedDriverId?: {
    _id?: string;
    collegeId?: string;
    name?: string;
    active?: boolean;
  } | string;
  assignedDriverName?: string;
  assignedRouteId?: Route | string;
  assignedRoute?: {
    id: string;
    name: string;
    code: string;
    stopCount: number;
  };
  active?: boolean;
  activeTrip?: {
    id: string;
    status: string;
    startedAt?: string;
    currentLocation?: Location;
    lastLocationAt?: string;
  } | null;
}

export interface Trip {
  id?: string;
  _id?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  lastLocationAt?: string;
  currentLocation?: Location;
  busId?: Bus | string;
  driverId?: User | string;
  routeId?: Route | string;
}

export interface TrackingData {
  bus: {
    id: string;
    busNumber: string;
    registrationNumber: string;
    capacity?: number;
    active: boolean;
  };
  driverName: string;
  route: {
    id: string;
    name: string;
    code: string;
    stops: Stop[];
    geometry: [number, number][];
  } | null;
  trip: {
    id: string;
    status: string;
    startedAt?: string;
    currentLocation?: Location;
    lastLocationAt?: string;
  } | null;
  isLive: boolean;
  locationAgeMs: number | null;
}

export interface FleetStats {
  totalBuses: number;
  totalRoutes: number;
  totalStops: number;
  totalDrivers: number;
  totalStudents: number;
  activeTrips: number;
}
