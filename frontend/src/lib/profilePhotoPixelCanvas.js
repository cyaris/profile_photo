import { configureCanvas2D } from "svelte-lib/functions/canvas"

import { advancePixelTransitionStates, getPixelTransitionDisplay } from "./profilePhotoPixelTransitions.js"

const separatorAlpha = 0.31
const separatorBuffersByGeometry = new WeakMap()

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
  if (renderState.opacity <= 0 || !renderState.rotation) return

  context.globalAlpha = renderState.opacity
  context.lineWidth = renderState.strokeWidth

  context.save()
  context.translate(renderState.translateX, renderState.translateY)
  context.rotate(renderState.rotation)
  context.strokeRect(renderState.x, renderState.y, renderState.width, renderState.height)
  context.restore()
}

function getSeparatorBuffers(geometry, pixelRatio) {
  let { cellHeight, cellWidth, columnCount, overflow, rowCount } = geometry
  let buffers = separatorBuffersByGeometry.get(geometry)

  if (
    buffers &&
    buffers.columnCount == columnCount &&
    buffers.rowCount == rowCount &&
    buffers.cellWidth == cellWidth &&
    buffers.cellHeight == cellHeight &&
    buffers.overflow == overflow &&
    buffers.pixelRatio == pixelRatio
  ) {
    buffers.opacities.fill(0)

    return buffers
  }

  let columnPositions = new Float64Array(columnCount + 1)
  let rowPositions = new Float64Array(rowCount + 1)

  for (let i = 0; i <= columnCount; i++) columnPositions[i] = Math.round((i * cellWidth + overflow) * pixelRatio)
  for (let i = 0; i <= rowCount; i++) rowPositions[i] = Math.round((i * cellHeight + overflow) * pixelRatio)

  buffers = {
    cellWidth,
    cellHeight,
    columnCount,
    columnPositions,
    opacities: new Float64Array(columnCount * rowCount),
    overflow,
    pixelRatio,
    rowCount,
    rowPositions
  }
  separatorBuffersByGeometry.set(geometry, buffers)

  return buffers
}

function drawPixelSeparators(context, pixelRenderStates, geometry, pixelRatio) {
  let { columnCount, columnPositions, opacities, rowCount, rowPositions } = getSeparatorBuffers(geometry, pixelRatio)

  for (let i = 0; i < pixelRenderStates.length; i++) {
    let { pixel, renderState } = pixelRenderStates[i]
    if (!renderState.rotation) opacities[pixel.y * columnCount + pixel.x] = renderState.opacity
  }

  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.fillStyle = "white"

  for (let column = 0; column <= columnCount; column++) {
    let x = columnPositions[column]
    let runStart = 0
    let runAlpha = 0

    for (let row = 0; row <= rowCount; row++) {
      let alpha = 0

      if (row < rowCount) {
        let left = column > 0 ? opacities[row * columnCount + column - 1] : 0
        let right = column < columnCount ? opacities[row * columnCount + column] : 0
        alpha = left > right ? left : right
      }

      if (alpha == runAlpha) continue

      if (runAlpha > 0) {
        context.globalAlpha = runAlpha * separatorAlpha
        context.fillRect(x, rowPositions[runStart], 1, rowPositions[row] - rowPositions[runStart])
      }

      runStart = row
      runAlpha = alpha
    }
  }

  for (let row = 0; row <= rowCount; row++) {
    let y = rowPositions[row]
    let runStart = 0
    let runAlpha = 0

    for (let column = 0; column <= columnCount; column++) {
      let alpha = 0

      if (column < columnCount) {
        let top = row > 0 ? opacities[(row - 1) * columnCount + column] : 0
        let bottom = row < rowCount ? opacities[row * columnCount + column] : 0
        alpha = top > bottom ? top : bottom
      }

      if (alpha == runAlpha) continue

      if (runAlpha > 0) {
        context.globalAlpha = runAlpha * separatorAlpha
        context.fillRect(columnPositions[runStart], y, columnPositions[column] - columnPositions[runStart], 1)
      }

      runStart = column
      runAlpha = alpha
    }
  }

  context.restore()
}

export function drawPixelCanvas({ canvas, geometry, pixels, states, timestamp }) {
  let overflow = geometry.overflow ?? 0
  let canvasHeight = geometry.height + overflow * 2
  let canvasWidth = geometry.width + overflow * 2
  let { context, pixelRatio } = configureCanvas2D({ canvas, height: canvasHeight, width: canvasWidth })
  if (!context) return false

  let pixelRenderStates = pixels.map(pixel => ({
    pixel,
    renderState: getPixelTransitionDisplay(pixel, states[pixel.index], geometry, timestamp)
  }))

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.save()
  context.translate(overflow, overflow)
  context.strokeStyle = "white"
  pixelRenderStates.forEach(({ pixel, renderState }) => fillPixel(context, pixel, renderState))
  drawPixelSeparators(context, pixelRenderStates, geometry, pixelRatio)
  pixelRenderStates.forEach(({ renderState }) => strokePixel(context, renderState))
  context.restore()

  return advancePixelTransitionStates(states, timestamp)
}
