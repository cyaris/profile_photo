import "svelte-lib/styles/app.css"
import "svelte-lib/styles/root.css"

import ProfilePhoto from "./lib/components/ProfilePhoto.svelte"

let div = document.createElement("div")
div.classList.add("profile-photo")

let script = document.currentScript
script.parentNode.insertBefore(div, script)

new ProfilePhoto({ target: div })
