import { defineConfig } from "vite";

export default defineConfig({
  // Dev server config
  server: {
    port: 5173,
    // Proxy API calls tới mock server khi dev
    // Đổi target thành URL thật khi chạy Live Mode
    proxy: {
      "/ca": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  // Đảm bảo import các file JS tuyệt đối từ src/
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
