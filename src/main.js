import ProfilePhoto from "./lib/components/ProfilePhoto.svelte"

import "../node_modules/svelte-lib/src/lib/static/styles/root.css"
import "../node_modules/svelte-lib/src/lib/static/styles/app.css"

let div = document.createElement("div")
div.classList.add("fireworks fixed top-0 left-0 w-full h-full z-50")

let script = document.currentScript
script.parentNode.insertBefore(div, script)

new ProfilePhoto({
  target: div,
})
