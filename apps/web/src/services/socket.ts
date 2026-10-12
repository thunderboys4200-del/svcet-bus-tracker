import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "../config/api.config";

let socketInstance: Socket | null = null;
let currentSocketUrl: string | null = null;

export function getSocket(): Socket {
  const targetUrl = getApiBaseUrl();

  // If the API base URL has changed, disconnect and reconnect to the new host
  if (socketInstance && currentSocketUrl !== targetUrl) {
    console.log(`[Socket.IO] Reconnecting to new server URL: ${targetUrl}`);
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentSocketUrl = targetUrl;
    socketInstance = io(targetUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      withCredentials: true,
    });

    socketInstance.on("connect", () => {
      console.log(`[Socket.IO] Connected to ${targetUrl}: ${socketInstance?.id}`);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Disconnected from ${targetUrl}: ${reason}`);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn(`[Socket.IO] Connection error to ${targetUrl}: ${err.message}`);
    });
  }

  return socketInstance;
}

if (typeof window !== "undefined") {
  window.addEventListener("svcet:api_url_changed", () => {
    getSocket();
  });
}

export function joinBusRoom(busId: string): void {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("join:bus", busId);
  } else {
    socket.once("connect", () => {
      socket.emit("join:bus", busId);
    });
  }
}

export function leaveBusRoom(busId: string): void {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("leave:bus", busId);
  }
}

export function joinTripRoom(tripId: string): void {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("join:trip", tripId);
  } else {
    socket.once("connect", () => {
      socket.emit("join:trip", tripId);
    });
  }
}

export function leaveTripRoom(tripId: string): void {
  const socket = getSocket();
  if (socket.connected) {
    socket.emit("leave:trip", tripId);
  }
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
