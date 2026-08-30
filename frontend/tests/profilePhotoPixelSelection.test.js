import assert from "node:assert/strict"
import test from "node:test"

import {
  advanceAutoTransitionPath,
  createAutoTransitionDiagonalPaths,
  createAutoTransitionFramePaths,
  createPixelModel,
  createTransitionNeighborhoods,
  getAutoTransitionDiagonalCornerIndex,
  getGridLinePixelIndexes,
  getPixelNeighborhood
} from "../src/lib/profilePhotoPixels.js"
import { createPixelStates, transitionReuseDuration } from "../src/lib/profilePhotoPixelTransitions.js"

const pixels = Array.from({ length: 16 }, (_, index) => ({
  id: `x${(index % 4) + 1}y${Math.floor(index / 4) + 1}`,
  rgb: "rgb(0, 0, 0)",
  x: index % 4,
  y: Math.floor(index / 4)
}))

test("pointer neighborhoods and sparse pointer paths remain selection-only calculations", () => {
  let { cellPixelIndexes, columnCount, pixelRecords, rowCount } = createPixelModel(pixels)
  let neighborhoods = createTransitionNeighborhoods({ cellPixelIndexes, columnCount, radius: 1, rowCount })

  assert.deepEqual(
    getPixelNeighborhood({ columnCount, neighborhoods, pixel: pixelRecords[5] }),
    [0, 4, 8, 1, 5, 9, 2, 6, 10]
  )
  assert.deepEqual(
    getGridLinePixelIndexes({
      cellPixelIndexes,
      columnCount,
      fromPixel: pixelRecords[0],
      rowCount,
      toPixel: pixelRecords[15]
    }),
    [0, 5, 10, 15]
  )
})

test("Frames and Diagonal select different paths through the same pixel states", () => {
  let { cellPixelIndexes, columnCount, pixelRecords, rowCount } = createPixelModel(pixels)
  let frames = createAutoTransitionFramePaths({ cellPixelIndexes, columnCount, cornerIndex: 0, radius: 0, rowCount })
  let diagonal = createAutoTransitionDiagonalPaths({ columnCount, cornerIndex: 0, pixels: pixelRecords, rowCount })

  assert.equal(frames.length, 2)
  assert.deepEqual(
    frames[0].slices.map(slice => slice.indexes),
    [[0], [1], [2], [3], [7], [11], [15], [14], [13], [12], [8], [4]]
  )
  assert.deepEqual(
    frames[1].slices.map(slice => slice.indexes),
    [[10], [9], [5], [6]]
  )
  assert.deepEqual(
    diagonal[0].slices.map(slice => slice.indexes.length),
    [1, 2, 3, 4, 3, 2, 1]
  )

  let states = createPixelStates(pixelRecords.length)
  let path = diagonal[0]

  assert.equal(advanceAutoTransitionPath({ path, now: 0, states }), true)
  assert.deepEqual(path.activeIndexes, [0])
  assert.equal(advanceAutoTransitionPath({ path, now: 10, states }), true)
  assert.deepEqual(path.activeIndexes, [1, 4])

  path.activeSliceIndex = path.slices.length - 1
  path.activeIndexes = []
  path.setCompletedAt = 20
  assert.equal(advanceAutoTransitionPath({ path, now: 21, setDelay: transitionReuseDuration, states }), false)
  assert.equal(path.activeSliceIndex, path.slices.length - 1)
})

test("Diagonal corner names begin paths at the selected portrait corner", () => {
  let { columnCount, pixelRecords, rowCount } = createPixelModel(pixels)
  let firstPixelIndex = { "top-left": 0, "top-right": 3, "bottom-right": 15, "bottom-left": 12 }

  Object.entries(firstPixelIndex).forEach(([corner, pixelIndex]) => {
    let [path] = createAutoTransitionDiagonalPaths({
      columnCount,
      cornerIndex: getAutoTransitionDiagonalCornerIndex(corner),
      pixels: pixelRecords,
      rowCount
    })

    assert.deepEqual(path.slices[0].indexes, [pixelIndex])
  })

  assert.equal(getAutoTransitionDiagonalCornerIndex("unsupported"), 0)
})

test("auto paths skip a slice until its shared pixel transition is reusable", () => {
  let states = createPixelStates(1)
  let path = { activeIndexes: [], activeSliceIndex: undefined, slices: [{ indexes: [0] }, { indexes: [0] }] }

  assert.equal(advanceAutoTransitionPath({ path, now: 0, states }), true)
  assert.equal(advanceAutoTransitionPath({ path, now: 1, states }), false)
  assert.equal(path.activeSliceIndex, 0)
  assert.deepEqual(path.activeIndexes, [])

  assert.equal(advanceAutoTransitionPath({ path, now: transitionReuseDuration + 1, states }), true)
  assert.equal(path.activeSliceIndex, 1)
  assert.deepEqual(path.activeIndexes, [0])
})
