import { clamp, easeCubicInOut } from "svelte-lib/functions"
import { configureCanvas2D } from "svelte-lib/functions/canvas"

const finalRotation = Math.PI / 4
const finalStrokeWidth = 0.3
const initialStrokeWidth = 0.075
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

function getTransitionRegionWidth(radius) {
  return Math.max(Math.floor(radius), 0) * 2 + 1
}

function getCellIndex({ columnCount, x, y }) {
  return y * columnCount + x
}

function getCellPixelIndex({ cellPixelIndexes, columnCount, rowCount, x, y }) {
  if (x < 0 || y < 0 || x >= columnCount || y >= rowCount) return -1

  return cellPixelIndexes[getCellIndex({ columnCount, x, y })]
}

function getPixelDisplay(pixel, geometry) {
  return {
    x: pixel.x * geometry.cellWidth,
    y: pixel.y * geometry.cellHeight,
    width: geometry.cellWidth,
    height: geometry.cellHeight,
    rotation: 0,
    translateX: 0,
    translateY: 0,
    opacity: 1,
    strokeWidth: initialStrokeWidth
  }
}

function getRotationTranslation(anchorX, anchorY, angle) {
  let cos = Math.cos(angle)
  let sin = Math.sin(angle)

  return { x: anchorX * (1 - cos) + anchorY * sin, y: anchorY * (1 - cos) - anchorX * sin }
}

function getActivatedPixelDisplay(pixel, geometry) {
  let normal = getPixelDisplay(pixel, geometry)
  let rotationTranslation = getRotationTranslation(normal.x, normal.y, finalRotation)

  return {
    ...normal,
    x: normal.x + geometry.cellWidth / 2 - 1.5,
    y: normal.y - geometry.cellHeight / 2,
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
    moveProgress: easeCubicInOut(clamp((timestamp - state.activationStart - transitionDelay) / transitionDuration)),
    fadeProgress: easeCubicInOut(clamp((timestamp - state.activationStart - transitionFadeDelay) / transitionDuration))
  }
}

function getActivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let normal = getPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let { moveProgress, fadeProgress } = getActivatingProgress(state, timestamp)

  return {
    x: normal.x + (activated.x - normal.x) * moveProgress,
    y: normal.y + (activated.y - normal.y) * moveProgress,
    width: normal.width + (activated.width - normal.width) * moveProgress,
    height: normal.height + (activated.height - normal.height) * moveProgress,
    rotation: finalRotation * moveProgress,
    translateX: activated.translateX * moveProgress,
    translateY: activated.translateY * moveProgress,
    opacity: 1 - fadeProgress,
    strokeWidth: finalStrokeWidth
  }
}

function getDeactivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let normal = getPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let reverseProgress = easeCubicInOut(
    clamp((timestamp - state.deactivationStart - transitionDeactivateDelay) / transitionDuration)
  )
  let strokeProgress = easeCubicInOut(
    clamp((timestamp - state.deactivationStart - transitionDeactivateDelay - transitionDuration) / transitionDuration)
  )
  let moveProgress = 1 - reverseProgress

  return {
    x: normal.x + (activated.x - normal.x) * moveProgress,
    y: normal.y + (activated.y - normal.y) * moveProgress,
    width: normal.width + (activated.width - normal.width) * moveProgress,
    height: normal.height + (activated.height - normal.height) * moveProgress,
    rotation: finalRotation * moveProgress,
    translateX: activated.translateX * moveProgress,
    translateY: activated.translateY * moveProgress,
    opacity: reverseProgress,
    strokeWidth: finalStrokeWidth + (initialStrokeWidth - finalStrokeWidth) * strokeProgress
  }
}

function getPixelRenderState(pixel, state, geometry, timestamp) {
  if (state.phase == pixelPhase.activating) return getActivatingPixelDisplay(pixel, state, geometry, timestamp)
  if (state.phase == pixelPhase.hidden) return getActivatedPixelDisplay(pixel, geometry)
  if (state.phase == pixelPhase.deactivating) return getDeactivatingPixelDisplay(pixel, state, geometry, timestamp)

  return getPixelDisplay(pixel, geometry)
}

function fillPixel(context, pixel, renderState) {
  if (renderState.opacity <= 0) return

  context.globalAlpha = renderState.opacity
  context.fillStyle = pixel.rgb

  if (!renderState.rotation) {
    context.fillRect(renderState.x, renderState.y, renderState.width, renderState.height)

    return
  }

  context.save()
  context.translate(renderState.translateX, renderState.translateY)
  context.rotate(renderState.rotation)
  context.fillRect(renderState.x, renderState.y, renderState.width, renderState.height)
  context.restore()
}

function strokePixel(context, renderState) {
  if (renderState.opacity <= 0) return

  context.globalAlpha = renderState.opacity
  context.lineWidth = renderState.strokeWidth

  if (!renderState.rotation) {
    context.strokeRect(renderState.x, renderState.y, renderState.width, renderState.height)

    return
  }

  context.save()
  context.translate(renderState.translateX, renderState.translateY)
  context.rotate(renderState.rotation)
  context.strokeRect(renderState.x, renderState.y, renderState.width, renderState.height)
  context.restore()
}

function compactFinishedStates(states, timestamp) {
  let hasAnimatingPixels = false

  states.forEach(state => {
    if (state.phase == pixelPhase.activating && timestamp - state.activationStart >= transitionTotalDuration) {
      state.phase = pixelPhase.hidden
    }

    if (
      (state.phase == pixelPhase.activating || state.phase == pixelPhase.hidden) &&
      state.deactivationStart &&
      timestamp - state.deactivationStart >= transitionDeactivateDelay
    ) {
      state.phase = pixelPhase.deactivating
    }

    if (
      state.phase == pixelPhase.deactivating &&
      timestamp - state.deactivationStart >= transitionDeactivateDelay + transitionDuration * 2
    ) {
      state.phase = pixelPhase.idle
      state.activationStart = 0
      state.deactivationStart = 0
    }

    if (state.phase == pixelPhase.activating || state.phase == pixelPhase.deactivating || state.deactivationStart) {
      hasAnimatingPixels = true
    }
  })

  return hasAnimatingPixels
}

function createPixelRecord(pixel, index) {
  return { ...pixel, index }
}

export function createPixelModel(sourcePixels) {
  let columnCount = Math.max(...sourcePixels.map(pixel => pixel.x + 1))
  let rowCount = Math.max(...sourcePixels.map(pixel => pixel.y + 1))
  let pixelRecords = sourcePixels.map(createPixelRecord)
  let cellPixelIndexes = new Int32Array(columnCount * rowCount)

  cellPixelIndexes.fill(-1)
  pixelRecords.forEach(pixel => (cellPixelIndexes[getCellIndex({ columnCount, x: pixel.x, y: pixel.y })] = pixel.index))

  return { cellPixelIndexes, columnCount, pixelRecords, rowCount }
}

export function createPixelStates(pixelCount) {
  return Array.from({ length: pixelCount }, () => ({
    phase: pixelPhase.idle,
    activationStart: 0,
    deactivationStart: 0
  }))
}

export function createRevealFlags(pixelCount) {
  return new Uint8Array(pixelCount)
}

function arePixelIndexesIdle({ indexes, states }) {
  return indexes.every(index => states[index].phase == pixelPhase.idle)
}

function getPixelIdleTime(state) {
  if (state.phase == pixelPhase.idle) return 0

  return state.deactivationStart
    ? state.deactivationStart + transitionDeactivateDelay + transitionDuration * 2
    : Infinity
}

function releaseReusablePixelIndexes({ indexes, now, states }) {
  indexes.forEach(index => {
    let state = states[index]

    if (getPixelIdleTime(state) <= now + timingTolerance) {
      state.phase = pixelPhase.idle
      state.activationStart = 0
      state.deactivationStart = 0
    }
  })
}

export function createTransitionNeighborhoods({ cellPixelIndexes, columnCount, rowCount, radius }) {
  let roundedRadius = Math.max(Math.floor(radius), 0)

  return Array.from({ length: cellPixelIndexes.length }, (_, cellIndex) => {
    let x = cellIndex % columnCount
    let y = Math.floor(cellIndex / columnCount)
    let indexes = []

    for (let offsetX = -roundedRadius; offsetX <= roundedRadius; offsetX += 1) {
      for (let offsetY = -roundedRadius; offsetY <= roundedRadius; offsetY += 1) {
        let pixelIndex = getCellPixelIndex({ cellPixelIndexes, columnCount, rowCount, x: x + offsetX, y: y + offsetY })

        if (pixelIndex >= 0) indexes.push(pixelIndex)
      }
    }

    return indexes
  })
}

export function getPixelIndexFromPoint({ cellPixelIndexes, columnCount, point, rowCount }) {
  if (!point?.width || !point?.height) return undefined

  let x = Math.floor((point.x / point.width) * columnCount)
  let y = Math.floor((point.y / point.height) * rowCount)
  let pixelIndex = getCellPixelIndex({ cellPixelIndexes, columnCount, rowCount, x, y })

  return pixelIndex >= 0 ? pixelIndex : undefined
}

export function getGridLinePixelIndexes({ cellPixelIndexes, columnCount, fromPixel, rowCount, toPixel }) {
  if (!fromPixel) return [toPixel.index]

  let steps = Math.max(Math.abs(toPixel.x - fromPixel.x), Math.abs(toPixel.y - fromPixel.y), 1)

  return Array.from({ length: steps + 1 }, (_, step) => {
    let t = step / steps
    let x = Math.round(fromPixel.x + (toPixel.x - fromPixel.x) * t)
    let y = Math.round(fromPixel.y + (toPixel.y - fromPixel.y) * t)

    return getCellPixelIndex({ cellPixelIndexes, columnCount, rowCount, x, y })
  }).filter(index => index >= 0)
}

export function getPixelNeighborhood({ neighborhoods, pixel, columnCount }) {
  return neighborhoods[getCellIndex({ columnCount, x: pixel.x, y: pixel.y })] ?? []
}

export function activatePixelIndexes({ indexes, isTransitionMode, now, onRevealPixel, states }) {
  let activatedIndexes = []

  indexes.forEach(index => {
    let state = states[index]
    if (state.phase != pixelPhase.idle) return

    state.phase = pixelPhase.activating
    state.activationStart = now
    state.deactivationStart = 0
    activatedIndexes.push(index)

    if (!isTransitionMode) onRevealPixel?.(index)
  })

  return activatedIndexes
}

export function deactivatePixelIndexes({ indexes, isTransitionMode, now, states }) {
  if (!isTransitionMode) return

  indexes.forEach(index => {
    let state = states[index]
    if (state.phase == pixelPhase.idle || state.phase == pixelPhase.deactivating || state.deactivationStart) return

    state.deactivationStart = now
  })
}

export function advanceAutoTransitionPath({ path, now, setDelay = transitionDuration / 32, states }) {
  if (!path.slices.length) return false

  let sliceIndex = path.activeSliceIndex === undefined ? 0 : (path.activeSliceIndex + 1) % path.slices.length
  let sliceIndexes = path.slices[sliceIndex].indexes

  deactivatePixelIndexes({ indexes: path.activeIndexes, isTransitionMode: true, now, states })
  path.activeIndexes = []

  if (sliceIndex == 0 && path.activeSliceIndex !== undefined && path.nextCycleStart === undefined) {
    path.nextCycleStart = path.setCompletedAt + setDelay
  }

  if (sliceIndex == 0 && path.nextCycleStart !== undefined) {
    if (now < path.nextCycleStart - timingTolerance) return false

    path.nextCycleStart = undefined
  }

  releaseReusablePixelIndexes({ indexes: sliceIndexes, now, states })
  if (!arePixelIndexesIdle({ indexes: sliceIndexes, states })) return false

  path.activeSliceIndex = sliceIndex
  path.activeIndexes = activatePixelIndexes({ indexes: sliceIndexes, isTransitionMode: true, now, states })

  if (sliceIndex == path.slices.length - 1) {
    path.setCompletedAt = now
  }

  return true
}

export function drawPixelCanvas({ canvas, geometry, pixels, states, timestamp }) {
  let overflow = geometry.overflow ?? 0
  let canvasHeight = geometry.height + overflow * 2
  let canvasWidth = geometry.width + overflow * 2
  let { context } = configureCanvas2D({ canvas, height: canvasHeight, width: canvasWidth })
  if (!context) return false

  let pixelRenderStates = pixels.map(pixel => ({
    pixel,
    renderState: getPixelRenderState(pixel, states[pixel.index], geometry, timestamp)
  }))

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.save()
  context.translate(overflow, overflow)
  context.strokeStyle = "white"
  pixelRenderStates.forEach(({ pixel, renderState }) => fillPixel(context, pixel, renderState))
  pixelRenderStates.forEach(({ renderState }) => strokePixel(context, renderState))
  context.restore()

  return compactFinishedStates(states, timestamp)
}

function createSlice(points, grid) {
  let indexes = points.map(({ x, y }) => getCellPixelIndex({ ...grid, x, y })).filter(index => index >= 0)

  return indexes.length ? { indexes } : undefined
}

function rotateSlices(slices, cornerIndex) {
  let startIndex = slices.findIndex(slice => slice.cornerIndex == cornerIndex)

  return startIndex <= 0 ? slices : [...slices.slice(startIndex), ...slices.slice(0, startIndex)]
}

function createVerticalSlice({ cornerIndex, maxY, minY, x }, grid) {
  return {
    ...createSlice(
      Array.from({ length: maxY - minY + 1 }, (_, index) => ({ x, y: minY + index })),
      grid
    ),
    cornerIndex
  }
}

function createHorizontalSlice({ cornerIndex, maxX, minX, y }, grid) {
  return {
    ...createSlice(
      Array.from({ length: maxX - minX + 1 }, (_, index) => ({ x: minX + index, y })),
      grid
    ),
    cornerIndex
  }
}

function createFilledSlices({ cornerIndex, maxX, maxY, minX, minY }, grid) {
  let sweepByColumn = maxX - minX >= maxY - minY
  let reverse = sweepByColumn ? cornerIndex == 1 || cornerIndex == 2 : cornerIndex == 2 || cornerIndex == 3

  let slices = sweepByColumn
    ? Array.from({ length: maxX - minX + 1 }, (_, index) => createVerticalSlice({ maxY, minY, x: minX + index }, grid))
    : Array.from({ length: maxY - minY + 1 }, (_, index) =>
        createHorizontalSlice({ maxX, minX, y: minY + index }, grid)
      )

  if (reverse) slices.reverse()

  return slices.filter(slice => slice?.indexes?.length)
}

function createCornerSlices({ cornerIndex, mapPoint, ringWidth }, grid) {
  let maxDiagonal = (ringWidth - 1) * 2
  let slices = []

  for (let diagonal = 0; diagonal <= maxDiagonal; diagonal += 1) {
    let iStart = Math.max(0, diagonal - (ringWidth - 1))
    let iEnd = Math.min(diagonal, ringWidth - 1)
    let points = Array.from({ length: iEnd - iStart + 1 }, (_, index) =>
      mapPoint(iStart + index, diagonal - iStart - index)
    )
    let slice = createSlice(points, grid)

    if (slice) slices.push({ ...slice, cornerIndex: diagonal == 0 ? cornerIndex : undefined })
  }

  return slices
}

function createFrameSlices({ cornerIndex, maxX, maxY, minX, minY, ringWidth }, grid) {
  let slices = []

  for (let x = minX; x <= maxX - ringWidth; x += 1) {
    slices.push(
      createVerticalSlice({ cornerIndex: x == minX ? 0 : undefined, maxY: minY + ringWidth - 1, minY, x }, grid)
    )
  }

  slices.push(
    ...createCornerSlices(
      { cornerIndex: 1, mapPoint: (i, j) => ({ x: maxX - ringWidth + 1 + i, y: minY + j }), ringWidth },
      grid
    )
  )

  for (let y = minY + ringWidth; y <= maxY - ringWidth; y += 1) {
    slices.push(createHorizontalSlice({ maxX, minX: maxX - ringWidth + 1, y }, grid))
  }

  slices.push(
    ...createCornerSlices(
      { cornerIndex: 2, mapPoint: (i, j) => ({ x: maxX - i, y: maxY - ringWidth + 1 + j }), ringWidth },
      grid
    )
  )

  for (let x = maxX - ringWidth; x >= minX + ringWidth; x -= 1) {
    slices.push(createVerticalSlice({ maxY, minY: maxY - ringWidth + 1, x }, grid))
  }

  slices.push(
    ...createCornerSlices(
      { cornerIndex: 3, mapPoint: (i, j) => ({ x: minX + ringWidth - 1 - i, y: maxY - j }), ringWidth },
      grid
    )
  )

  for (let y = maxY - ringWidth; y >= minY + ringWidth; y -= 1) {
    slices.push(createHorizontalSlice({ maxX: minX + ringWidth - 1, minX, y }, grid))
  }

  return rotateSlices(
    slices.filter(slice => slice?.indexes?.length),
    cornerIndex
  )
}

export function createAutoTransitionFramePaths({ cellPixelIndexes, columnCount, cornerIndex, radius, rowCount }) {
  let baseRingWidth = getTransitionRegionWidth(radius)
  let grid = { cellPixelIndexes, columnCount, rowCount }
  let paths = []

  for (
    let inset = 0, index = 0;
    inset < Math.ceil(Math.min(columnCount, rowCount) / 2);
    inset += baseRingWidth, index += 1
  ) {
    let minX = inset
    let minY = inset
    let maxX = columnCount - 1 - inset
    let maxY = rowCount - 1 - inset
    let remainingWidth = maxX - minX + 1
    let remainingHeight = maxY - minY + 1
    let ringWidth = Math.min(baseRingWidth, Math.floor(Math.min(remainingWidth, remainingHeight) / 2))
    let pathCornerIndex = index % 2 ? (cornerIndex + 2) % 4 : cornerIndex

    paths.push({
      activeIndexes: [],
      activeSliceIndex: undefined,
      slices:
        ringWidth < baseRingWidth
          ? createFilledSlices({ cornerIndex: pathCornerIndex, maxX, maxY, minX, minY }, grid)
          : createFrameSlices({ cornerIndex: pathCornerIndex, maxX, maxY, minX, minY, ringWidth }, grid)
    })
  }

  return paths.filter(path => path.slices.length)
}

export function createAutoTransitionDiagonalPaths({ columnCount, cornerIndex, pixels, rowCount }) {
  let mirrorX = cornerIndex == 1 || cornerIndex == 2
  let mirrorY = cornerIndex == 2 || cornerIndex == 3
  let diagonalIndexes = Array.from({ length: columnCount + rowCount - 1 }, () => [])

  pixels.forEach(pixel => {
    let x = mirrorX ? columnCount - 1 - pixel.x : pixel.x
    let y = mirrorY ? rowCount - 1 - pixel.y : pixel.y

    diagonalIndexes[x + y].push(pixel.index)
  })

  return [
    {
      activeIndexes: [],
      activeSliceIndex: undefined,
      slices: diagonalIndexes.filter(indexes => indexes.length).map(indexes => ({ indexes }))
    }
  ]
}
