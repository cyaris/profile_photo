import assert from "node:assert/strict"
import test from "node:test"

import { createLaserEyeBurst, getLaserEyeDraw } from "../src/lib/laserEye.js"

test("laser-eye starting radius and stroke scale with the rendered portrait", () => {
  let [desktopCircle] = createLaserEyeBurst({ displayHeight: 400, displayWidth: 400, now: 1000 })
  let [mobileCircle] = createLaserEyeBurst({ displayHeight: 200, displayWidth: 200, now: 1000 })
  let desktopDraw = getLaserEyeDraw(desktopCircle, 1000)
  let mobileDraw = getLaserEyeDraw(mobileCircle, 1000)

  assert.equal(desktopDraw.radius, 0.25)
  assert.equal(desktopDraw.strokeWidth, 7.5)
  assert.equal(mobileDraw.radius, desktopDraw.radius / 2)
  assert.equal(mobileDraw.strokeWidth, desktopDraw.strokeWidth / 2)
})
