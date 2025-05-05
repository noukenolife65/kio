import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    target: "es2016",
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@kintone/rest-api-client"],
    },
  },
  plugins: [dts({ rollupTypes: true })],
});
