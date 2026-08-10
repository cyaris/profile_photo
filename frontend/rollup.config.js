import { createRollupConfig } from "svelte-lib/rollup.config.js"

export default createRollupConfig({
  entries: [
    { input: "./src/homepage.js", output: { format: "iife", file: "dist/homepage_bundle.js" } },
    { input: "./src/main.js", output: { format: "iife", file: "dist/bundle.js" } }
  ],
  scopeClass: "profile-photo"
})
