import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "kio",
      fileName: "kio",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@kintone/rest-api-client"],
    },
  },
  plugins: [dts()],
});
