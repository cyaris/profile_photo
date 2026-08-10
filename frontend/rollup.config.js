import { createRollupConfig } from "svelte-lib/rollup.config.js"

export default createRollupConfig({
  entries: [
    { input: "./src/main.js", output: { format: "iife", file: "dist/bundle.js" } },
    { input: "./src/main2.js", output: { format: "iife", file: "dist/bundle2.js" } }
  ],
  scopeClass: "profile-photo"
})
