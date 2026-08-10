import "svelte-lib/styles/app.css"
import "svelte-lib/styles/root.css"

import ProfilePhoto from "./components/App.svelte"

export function mountProfilePhoto(props = {}) {
  let div = document.createElement("div")
  div.classList.add("profile-photo")

  let script = document.currentScript
  script.parentNode.insertBefore(div, script)

  return new ProfilePhoto({ target: div, props })
}
