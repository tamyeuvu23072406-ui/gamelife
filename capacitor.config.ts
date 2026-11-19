import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.soulmate.lifesim",
  appName: "Soulmate",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
};

export default config;
