import ProfilePhoto from "./lib/components/ProfilePhoto.svelte"

import "../node_modules/svelte-lib/src/lib/static/styles/root.css"
import "../node_modules/svelte-lib/src/lib/static/styles/app.css"

let div = document.createElement("div")
div.classList.add("profile-photo")

  // console.log(profilePhoto)
// document.body.appendChild(profilePhoto)

let script = document.currentScript
script.parentNode.insertBefore(div, script)

new ProfilePhoto({
  target: div,
})
