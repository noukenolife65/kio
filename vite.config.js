import {defineConfig} from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: 'kio',
      fileName: 'kio',
    },
  },
});
