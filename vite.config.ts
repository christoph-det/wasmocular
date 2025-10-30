import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    proxy: {
      // Frontend calls /git/...
      "/git-proxy": {
        target: "https://github.com",
        changeOrigin: true,
        secure: true,
        // strip the prefix so /git/user/repo.git/... -> /user/repo.git/...
        rewrite: (path) => path.replace(/^\/git-proxy/, ""),
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("user-agent", "git/2.0");
          });
        }
      }
    }
  }
});
