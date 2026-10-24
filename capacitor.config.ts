import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nexovonarsa.apkforgeai",
  appName: "APKForge AI",
  webDir: "public",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https"
  }
};

export default config;
