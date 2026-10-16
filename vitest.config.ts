import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@engine": path.resolve(root, "calculation-engine"),
      "@domain": path.resolve(root, "domain"),
      "@structural": path.resolve(root, "structural-engine"),
      "@memorial": path.resolve(root, "memorial-engine"),
      "@block": path.resolve(root, "block-engine"),
      "@footing": path.resolve(root, "footing-engine"),
      "@caisson": path.resolve(root, "caisson-engine"),
      "@raft": path.resolve(root, "raft-engine"),
      "@assist": path.resolve(root, "assist-engine"),
      "@group": path.resolve(root, "pile-group-engine"),
      "@conception": path.resolve(root, "conception-engine"),
      "@drawing": path.resolve(root, "drawing-engine"),
    },
  },
});
