import { configureCanvas2D } from "svelte-lib/functions/canvas"

const finalRotation = Math.PI / 4
const finalStrokeWidth = 0.3
const initialStrokeWidth = 0.075

export const transitionDelay = 100
export const transitionDuration = 750

const transitionFadeDelay = transitionDelay + transitionDuration + transitionDelay
const transitionTotalDuration = transitionFadeDelay + transitionDuration
const transitionDeactivateDelay = transitionDelay * 2 + transitionDuration * 2 + 300

const pixelPhase = { idle: 0, activating: 1, hidden: 2, deactivating: 3 }

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
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
  let x = pixel.x * geometry.cellWidth
  let y = pixel.y * geometry.cellHeight

  return {
    x,
    y,
    width: geometry.cellWidth,
    height: geometry.cellHeight,
    rotation: 0,
    opacity: 1,
    strokeWidth: initialStrokeWidth,
    anchorX: x,
    anchorY: y
  }
}

function getActivatedPixelDisplay(pixel, geometry) {
  let normal = getPixelDisplay(pixel, geometry)

  return {
    ...normal,
    x: normal.x + geometry.cellWidth / 2 - 1.5,
    y: normal.y - geometry.cellHeight / 2,
    width: geometry.cellWidth / 1.5,
    height: geometry.cellHeight / 1.5,
    rotation: finalRotation,
    opacity: 0,
    strokeWidth: finalStrokeWidth
  }
}

function getActivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let normal = getPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let moveProgress = clamp((timestamp - state.activationStart - transitionDelay) / transitionDuration)
  let fadeProgress = clamp((timestamp - state.activationStart - transitionFadeDelay) / transitionDuration)

  return {
    x: normal.x + (activated.x - normal.x) * moveProgress,
    y: normal.y + (activated.y - normal.y) * moveProgress,
    width: normal.width + (activated.width - normal.width) * moveProgress,
    height: normal.height + (activated.height - normal.height) * moveProgress,
    rotation: finalRotation * moveProgress,
    opacity: 1 - fadeProgress,
    strokeWidth: finalStrokeWidth,
    anchorX: normal.anchorX,
    anchorY: normal.anchorY
  }
}

function getDeactivatingPixelDisplay(pixel, state, geometry, timestamp) {
  let normal = getPixelDisplay(pixel, geometry)
  let activated = getActivatedPixelDisplay(pixel, geometry)
  let moveProgress = clamp((timestamp - state.deactivationStart - transitionDeactivateDelay) / transitionDuration)
  let strokeProgress = clamp(
    (timestamp - state.deactivationStart - transitionDeactivateDelay - transitionDuration) / transitionDuration
  )

  return {
    x: activated.x + (normal.x - activated.x) * moveProgress,
    y: activated.y + (normal.y - activated.y) * moveProgress,
    width: activated.width + (normal.width - activated.width) * moveProgress,
    height: activated.height + (normal.height - activated.height) * moveProgress,
    rotation: finalRotation * (1 - moveProgress),
    opacity: moveProgress,
    strokeWidth: finalStrokeWidth + (initialStrokeWidth - finalStrokeWidth) * strokeProgress,
    anchorX: normal.anchorX,
    anchorY: normal.anchorY
  }
}

function getPixelRenderState(pixel, state, geometry, timestamp) {
  if (state.phase == pixelPhase.activating) return getActivatingPixelDisplay(pixel, state, geometry, timestamp)
  if (state.phase == pixelPhase.hidden) return getActivatedPixelDisplay(pixel, geometry)
  if (state.phase == pixelPhase.deactivating) return getDeactivatingPixelDisplay(pixel, state, geometry, timestamp)

  return getPixelDisplay(pixel, geometry)
}

function drawPixel(context, pixel, renderState) {
  if (renderState.opacity <= 0) return

  context.save()
  context.globalAlpha = renderState.opacity
  context.fillStyle = pixel.rgb
  context.strokeStyle = "white"
  context.lineWidth = renderState.strokeWidth
  context.translate(renderState.anchorX, renderState.anchorY)
  context.rotate(renderState.rotation)
  context.fillRect(
    renderState.x - renderState.anchorX,
    renderState.y - renderState.anchorY,
    renderState.width,
    renderState.height
  )
  context.strokeRect(
    renderState.x - renderState.anchorX,
    renderState.y - renderState.anchorY,
    renderState.width,
    renderState.height
  )
  context.restore()
}

function compactFinishedStates(states, timestamp) {
  let hasAnimatingPixels = false

  states.forEach(state => {
    if (state.phase == pixelPhase.activating && timestamp - state.activationStart >= transitionTotalDuration) {
      state.phase = pixelPhase.hidden
    } else if (
      state.phase == pixelPhase.deactivating &&
      timestamp - state.deactivationStart >= transitionDeactivateDelay + transitionDuration * 2
    ) {
      state.phase = pixelPhase.idle
      state.activationStart = 0
      state.deactivationStart = 0
    }

    if (state.phase == pixelPhase.activating || state.phase == pixelPhase.deactivating) {
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
    if (state.phase == pixelPhase.idle || state.phase == pixelPhase.deactivating) return

    state.phase = pixelPhase.deactivating
    state.deactivationStart = now
  })
}

export function drawPixelCanvas({ canvas, geometry, pixels, states, timestamp }) {
  let { context } = configureCanvas2D({ canvas, height: geometry.height, width: geometry.width })
  if (!context) return false

  context.clearRect(0, 0, geometry.width, geometry.height)
  pixels.forEach(pixel =>
    drawPixel(context, pixel, getPixelRenderState(pixel, states[pixel.index], geometry, timestamp))
  )

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

function createFrameSlices({ cornerIndex, maxX, maxY, minX, minY, ringWidth }, grid) {
  let slices = []

  for (let x = minX; x <= maxX; x += 1) {
    slices.push(
      createVerticalSlice(
        { cornerIndex: x == minX ? 0 : x == maxX ? 1 : undefined, maxY: minY + ringWidth - 1, minY, x },
        grid
      )
    )
  }

  for (let y = minY + ringWidth; y <= maxY; y += 1) {
    slices.push(
      createHorizontalSlice({ cornerIndex: y == maxY ? 2 : undefined, maxX, minX: maxX - ringWidth + 1, y }, grid)
    )
  }

  for (let x = maxX - ringWidth; x >= minX; x -= 1) {
    slices.push(
      createVerticalSlice({ cornerIndex: x == minX ? 3 : undefined, maxY, minY: maxY - ringWidth + 1, x }, grid)
    )
  }

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
    let ringWidth = Math.min(baseRingWidth, Math.ceil(Math.min(remainingWidth, remainingHeight) / 2))
    let pathCornerIndex = index % 2 ? (cornerIndex + 2) % 4 : cornerIndex

    paths.push({
      activeIndexes: [],
      activeSliceIndex: undefined,
      slices: createFrameSlices({ cornerIndex: pathCornerIndex, maxX, maxY, minX, minY, ringWidth }, grid)
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
