import assert from "node:assert/strict"
import test from "node:test"

import {
  activatePixelIndexes,
  advancePixelTransitionStates,
  createPixelStates,
  deactivatePixelIndexes,
  getPixelTransitionDisplay,
  transitionDelay,
  transitionDuration,
  transitionReuseDuration
} from "../src/lib/profilePhotoPixelTransitions.js"

const geometry = { cellWidth: 10, cellHeight: 8 }
const pixel = { index: 0, x: 2, y: 3 }
const activationDuration = transitionDelay + transitionDuration + transitionDelay + transitionDuration
const restorationDelay = activationDuration + 300

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to equal ${expected}`)
}

test("one shared transition reproduces the native activation and restoration phases", () => {
  let states = createPixelStates(1)
  let activationStart = 1000

  assert.deepEqual(activatePixelIndexes({ indexes: [0], now: activationStart, states }), [0])
  assert.deepEqual(activatePixelIndexes({ indexes: [0], now: activationStart + 1, states }), [])

  let resting = getPixelTransitionDisplay(pixel, states[0], geometry, activationStart)
  assert.deepEqual(
    {
      x: resting.x,
      y: resting.y,
      width: resting.width,
      height: resting.height,
      rotation: resting.rotation,
      opacity: resting.opacity,
      strokeWidth: resting.strokeWidth
    },
    { x: 20, y: 24, width: 10, height: 8, rotation: 0, opacity: 1, strokeWidth: 0.3 }
  )
  assertClose(resting.translateX, 0)
  assertClose(resting.translateY, 0)

  let halfway = getPixelTransitionDisplay(
    pixel,
    states[0],
    geometry,
    activationStart + transitionDelay + transitionDuration / 2
  )
  assertClose(halfway.x, 21.75)
  assertClose(halfway.y, 22)
  assertClose(halfway.width, 25 / 3)
  assertClose(halfway.height, 20 / 3)
  assertClose(halfway.rotation, Math.PI / 8)
  assert.equal(halfway.opacity, 1)

  advancePixelTransitionStates(states, activationStart + activationDuration)
  let activated = getPixelTransitionDisplay(pixel, states[0], geometry, activationStart + activationDuration)
  assert.deepEqual(
    { x: activated.x, y: activated.y, width: activated.width, height: activated.height, opacity: activated.opacity },
    { x: 23.5, y: 20, width: 20 / 3, height: 16 / 3, opacity: 0 }
  )
  assertClose(activated.rotation, Math.PI / 4)

  let deactivationStart = activationStart + 20
  deactivatePixelIndexes({ indexes: [0], now: deactivationStart, states })
  advancePixelTransitionStates(states, deactivationStart + restorationDelay)

  let restoring = getPixelTransitionDisplay(
    pixel,
    states[0],
    geometry,
    deactivationStart + restorationDelay + transitionDuration / 2
  )
  assertClose(restoring.x, 21.75)
  assertClose(restoring.y, 22)
  assertClose(restoring.opacity, 0.5)
  assertClose(restoring.rotation, Math.PI / 8)

  advancePixelTransitionStates(states, deactivationStart + transitionReuseDuration - 1)
  assert.deepEqual(
    activatePixelIndexes({ indexes: [0], now: deactivationStart + transitionReuseDuration - 1, states }),
    []
  )

  advancePixelTransitionStates(states, deactivationStart + transitionReuseDuration)
  assert.deepEqual(
    activatePixelIndexes({ indexes: [0], now: deactivationStart + transitionReuseDuration, states }),
    [0]
  )
})

test("a transition scheduled at timestamp zero is restored instead of treated as unset", () => {
  let states = createPixelStates(1)

  activatePixelIndexes({ indexes: [0], now: 0, states })
  deactivatePixelIndexes({ indexes: [0], now: 0, states })

  assert.equal(advancePixelTransitionStates(states, transitionReuseDuration - 1), true)
  assert.equal(advancePixelTransitionStates(states, transitionReuseDuration), false)
  assert.deepEqual(activatePixelIndexes({ indexes: [0], now: transitionReuseDuration, states }), [0])
})
