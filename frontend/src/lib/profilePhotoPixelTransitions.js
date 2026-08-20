import { getEasedProgress } from "svelte-lib/functions/canvas"
import { easeCubicInOut } from "svelte-lib/functions/easing"

const finalRotation = Math.PI / 4
const finalStrokeWidth = 0.3
const timingTolerance = 0.001
const transitionHiddenHoldDuration = 300

export const transitionDelay = 100
export const transitionDuration = 750

const transitionFadeDelay = transitionDelay + transitionDuration + transitionDelay
const transitionTotalDuration = transitionFadeDelay + transitionDuration
const transitionDeactivateDelay = transitionTotalDuration + transitionHiddenHoldDuration
export const transitionReuseDuration = transitionDeactivateDelay + transitionDuration * 2

const pixelPhase = { idle: 0, activating: 1, hidden: 2, deactivating: 3 }

export function getAutoTransitionPixelHiddenDuration(stepInterval) {
  return transitionHiddenHoldDuration + stepInterval
}

function getRestingPixelDisplay(pixel, geometry) {
  return {
    x: pixel.x * geometry.cellWidth,
    y: pixel.y * geometry.cellHeight,
    width: geometry.cellWidth,
    height: geometry.cellHeight,
    rotation: 0,
    translateX: 0,
    translateY: 0,
    opacity: 1
  }
}

function getRotationTranslation(anchorX, anchorY, angle) {
  let cos = Math.cos(angle)
  let sin = Math.sin(angle)

  return { x: anchorX * (1 - cos) + anchorY * sin, y: anchorY * (1 - cos) - anchorX * sin }
}

function getActivatedPixelDisplay(pixel, geometry) {
  let resting = getRestingPixelDisplay(pixel, geometry)
  let rotationTranslation = getRotationTranslation(resting.x, resting.y, finalRotation)

  return {
    ...resting,
    x: resting.x + geometry.cellWidth / 2 - 1.5,
    y: resting.y - geometry.cellHeight / 2,
    width: geometry.cellWidth / 1.5,
    height: geometry.cellHeight / 1.5,
    rotation: finalRotation,
    translateX: rotationTranslation.x,
    translateY: rotationTranslation.y,
    opacity: 0,
    strokeWidth: finalStrokeWidth
  }
}

function getActivatingProgress(state, timestamp) {
  return {
    moveProgress: getEasedProgress({
      delay: transitionDelay,
      duration: transitionDuration,
      ease: easeCubicInOut,
      now: timestamp,
      start: state.activationStart
    }),
    fadeProgress: getEasedProgress({
      delay: transitionFadeDelay,
      duration: transitionDuration,
      ease: easeCubicInOut,
      now: timestamp,
      start: state.activationStart
    })
  }
}

function getTransitioningPixelDisplay(resting, activated, moveProgress, opacity) {
  return {
    x: resting.x + (activated.x - resting.x) * moveProgress,
    y: resting.y + (activated.y - resting.y) * moveProgress,
    width: resting.width + (activated.width - resting.width) * moveProgress,
    height: resting.height + (activated.height - resting.height) * moveProgress,
    rotation: finalRotation * moveProgress,
    translateX: activated.translateX * moveProgress,
    translateY: activated.translateY * moveProgress,
    opacity,
    strokeWidth: finalStrokeWidth
  }
}

function getActivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let resting = getRestingPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let { moveProgress, fadeProgress } = getActivatingProgress(state, timestamp)

  return getTransitioningPixelDisplay(resting, activated, moveProgress, 1 - fadeProgress)
}

function getDeactivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let resting = getRestingPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let reverseProgress = getEasedProgress({
    delay: transitionDeactivateDelay,
    duration: transitionDuration,
    ease: easeCubicInOut,
    now: timestamp,
    start: state.deactivationStart
  })

  return getTransitioningPixelDisplay(resting, activated, 1 - reverseProgress, reverseProgress)
}

export function getPixelTransitionDisplay(pixel, state, geometry, timestamp) {
  if (state.phase == pixelPhase.activating) return getActivatingPixelDisplay(pixel, state, geometry, timestamp)
  if (state.phase == pixelPhase.hidden) return getActivatedPixelDisplay(pixel, geometry)
  if (state.phase == pixelPhase.deactivating) return getDeactivatingPixelDisplay(pixel, state, geometry, timestamp)

  return getRestingPixelDisplay(pixel, geometry)
}

export function advancePixelTransitionStates(states, timestamp) {
  let hasActiveTransitions = false

  states.forEach(state => {
    if (state.phase == pixelPhase.activating && timestamp - state.activationStart >= transitionTotalDuration) {
      state.phase = pixelPhase.hidden
    }

    if (
      (state.phase == pixelPhase.activating || state.phase == pixelPhase.hidden) &&
      state.deactivationStart !== undefined &&
      timestamp - state.deactivationStart >= transitionDeactivateDelay
    ) {
      state.phase = pixelPhase.deactivating
    }

    if (
      state.phase == pixelPhase.deactivating &&
      timestamp - state.deactivationStart >= transitionDeactivateDelay + transitionDuration * 2
    ) {
      state.phase = pixelPhase.idle
      state.activationStart = undefined
      state.deactivationStart = undefined
    }

    if (
      state.phase == pixelPhase.activating ||
      state.phase == pixelPhase.deactivating ||
      state.deactivationStart !== undefined
    ) {
      hasActiveTransitions = true
    }
  })

  return hasActiveTransitions
}

export function createPixelStates(pixelCount) {
  return Array.from({ length: pixelCount }, () => ({
    phase: pixelPhase.idle,
    activationStart: undefined,
    deactivationStart: undefined
  }))
}

export function activatePixelIndexes({ indexes, now, states }) {
  return indexes.filter(index => {
    let state = states[index]
    if (state.phase != pixelPhase.idle) return false

    state.phase = pixelPhase.activating
    state.activationStart = now
    state.deactivationStart = undefined

    return true
  })
}

export function deactivatePixelIndexes({ indexes, now, states }) {
  indexes.forEach(index => {
    let state = states[index]
    if (
      state.phase == pixelPhase.idle ||
      state.phase == pixelPhase.deactivating ||
      state.deactivationStart !== undefined
    ) {
      return
    }

    state.deactivationStart = now
  })
}

export function arePixelIndexesIdle({ indexes, states }) {
  return indexes.every(index => states[index].phase == pixelPhase.idle)
}

function getPixelIdleTime(state) {
  if (state.phase == pixelPhase.idle) return 0

  return state.deactivationStart === undefined
    ? Infinity
    : state.deactivationStart + transitionDeactivateDelay + transitionDuration * 2
}

export function releaseReusablePixelIndexes({ indexes, now, states }) {
  indexes.forEach(index => {
    let state = states[index]

    if (getPixelIdleTime(state) <= now + timingTolerance) {
      state.phase = pixelPhase.idle
      state.activationStart = undefined
      state.deactivationStart = undefined
    }
  })
}
