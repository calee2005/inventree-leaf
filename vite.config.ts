import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react-swipeable-list$/,
        replacement: fileURLToPath(
          new URL("./node_modules/react-swipeable-list/dist/react-swipeable-list.esm.js", import.meta.url),
        ),
      },
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
  },
});
