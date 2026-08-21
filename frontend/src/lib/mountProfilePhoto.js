import "svelte-lib/styles/app.css"
import "svelte-lib/styles/root.css"

import { mountEmbeddedRoot } from "svelte-lib/functions/dom"

import ProfilePhoto from "./components/App.svelte"

export function mountProfilePhoto({ target, ...props } = {}) {
  return new ProfilePhoto({ target: mountEmbeddedRoot({ classes: ["profile-photo"], target }), props })
}
