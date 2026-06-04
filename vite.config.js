import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true, // ポートが使用中なら起動せずエラー
    allowedHosts: [".trycloudflare.com"],
  },
});
