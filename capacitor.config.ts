import type { CapacitorConfig } from "@capacitor/cli";

// UNTESTED: webDir must point at a static client build (see ANDROID.md).
const config: CapacitorConfig = {
  appId: "com.soulmate.lifesim",
  appName: "Soulmate",
  webDir: "dist/client",
  server: { androidScheme: "https" },
};

export default config;
