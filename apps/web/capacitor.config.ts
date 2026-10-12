import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "in.ac.svcet.bustracker",
  appName: "SVCET Smart Bus Tracker",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
};

export default config;
