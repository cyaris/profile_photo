<script>
  import "d3-transition"

  import { select } from "d3-selection"
  import { interval } from "d3-timer"
  import { FireworkShow } from "fireworks/components"
  import { onDestroy, onMount } from "svelte"
  import { Loading, ProgressBar, Select } from "svelte-lib/components"

  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"

  export let forcedMode = undefined
  export let showModeSelection = true
  export let transitionPixelRadius = 2

  const pixelColumnCount = Math.max(...pixels.map(v => v.x + 1))
  const pixelRowCount = Math.max(...pixels.map(v => v.y + 1))
  const pixelIds = new Set(pixels.map(v => v.id))
  const modeItems = [
    { value: "reveal", label: "Reveal" },
    { value: "reveal_my_laser_vision", label: "Reveal My Laser Vision" },
    { value: "transition", label: "Transition" },
    { value: "auto_transition_frames", label: "Auto Transition (Frames)" },
    { value: "auto_transition_diagonal", label: "Auto Transition (Diagonal)" }
  ]

  function getModeValue(mode) {
    return modeItems.findIndex(item => item.value == mode)
  }

  function getRelativeTransitionIds(radius) {
    let roundedRadius = Math.max(Math.floor(radius), 0)

    return Array.from({ length: roundedRadius * 2 + 1 }, (_, xIndex) =>
      Array.from({ length: roundedRadius * 2 + 1 }, (_, yIndex) => ({
        x: xIndex - roundedRadius,
        y: yIndex - roundedRadius
      }))
    ).flat()
  }

  function getTransitionRegionWidth(radius = transitionPixelRadius) {
    return Math.max(Math.floor(radius), 0) * 2 + 1
  }

  let width
  let height
  let pixelWidth
  let pixelHeight
  let profilePhoto
  let pixelCanvas
  let laserEyeCanvas
  // TODO: fix bug where img renders at 5px less than height variable.
  let imgHeightDifference

  let transitionDelay = 100
  const transitionDuration = 750

  export let autoTransitionStepDuration = transitionDuration / 32

  let revealedPixelIds = new Set()
  let sliderValue = Math.max(getModeValue(forcedMode), 0)
  let modeSelectValue = modeItems[sliderValue]
  let laserEyesTimer
  let activePointerId
  let activePointerPixel
  let activePointerTarget
  let autoTransitionFrame
  let autoTransitionPaths = []
  let autoTransitionLastStepTime
  let autoTransitionKey
  let prefersReducedMotion = false

  const progressBarColorScale = () => "#006D2C"

  const fireworkRevealTrigger = 0.9

  $: revealedPixelRatio = revealedPixelIds.size / pixels.length
  $: activeMode = modeItems[sliderValue]?.value ?? modeItems[0].value
  $: modeSelectValue = modeItems[sliderValue] ?? modeItems[0]
  $: forcedModeValue = getModeValue(forcedMode)
  $: isAutoTransitionFrames = activeMode == "auto_transition_frames"
  $: isAutoTransitionDiagonal = activeMode == "auto_transition_diagonal"
  $: isAutoTransition = isAutoTransitionFrames || isAutoTransitionDiagonal
  $: isTransitionMode = activeMode == "transition" || isAutoTransition
  $: autoTransitionStepInterval = Number.isFinite(autoTransitionStepDuration)
    ? Math.max(autoTransitionStepDuration, 1)
    : transitionDuration / 32
  $: autoTransitionConfigKey = [
    activeMode,
    transitionPixelRadius,
    autoTransitionStepInterval,
    pixelColumnCount,
    pixelRowCount
  ].join(":")

  function getTransitionIds(id, radius = transitionPixelRadius) {
    let x = parseInt(id.split("y")[0].substring(1))
    let y = parseInt(id.split("y")[1])

    return getRelativeTransitionIds(radius)
      .map(v => "#x" + String(v.x + x) + "y" + String(v.y + y))
      .filter(v => pixelIds.has(v.slice(1)))
  }

  function activateTransitionIds(transitionIds) {
    let activatedTransitionIds = transitionIds.filter(v => !select(v).classed("non-reactive"))

    if (activatedTransitionIds.length) {
      if (!isTransitionMode) {
        revealedPixelIds = new Set([...revealedPixelIds, ...activatedTransitionIds])
      }
      select(pixelCanvas)
        .selectAll(activatedTransitionIds.join(", "))
        .classed("non-reactive", true)
        .style("stroke-width", 0.3)
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .attr("x", d => d.x * pixelWidth + pixelWidth / 2 - 1.5)
        .attr("y", d => d.y * pixelHeight - pixelHeight / 2)
        .attr("width", pixelWidth / 1.5)
        .attr("height", pixelHeight / 1.5)
        .attr("transform", d => "rotate(45," + d.x * pixelWidth + "," + d.y * pixelHeight + ")")
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .style("opacity", 0)
    }

    return activatedTransitionIds
  }

  function activatePixel(pixelElement, radius = transitionPixelRadius) {
    if (select(pixelElement).classed("non-reactive")) {
      return
    }

    activateTransitionIds(getTransitionIds(select(pixelElement).attr("id"), radius))
  }

  let pixelMouseOver = function () {
    activatePixel(this)
  }

  function deactivateTransitionIds(transitionIds) {
    // mouseleave function is only needed for transition mode because otherwise the pixel will be removed.
    if (isTransitionMode) {
      if (transitionIds.length) {
        let rects = select(pixelCanvas).selectAll(transitionIds.join(", "))

        rects
          .transition()
          .delay(transitionDelay * 2 + transitionDuration * 2 + 300)
          .duration(transitionDuration)
          .attr("x", d => d.x * pixelWidth)
          .attr("y", d => d.y * pixelHeight)
          .attr("width", pixelWidth)
          .attr("height", pixelHeight)
          .attr("transform", d => "rotate(0," + d.x * pixelWidth + "," + d.y * pixelHeight + ")")
          .style("opacity", 1)
          .transition()
          // .delay(transitionDelay)
          .duration(transitionDuration)
          .style("stroke-width", 0.075)
          .on("end", () => rects.classed("non-reactive", false))
      }
    }
  }

  function deactivatePixel(pixelElement, radius = transitionPixelRadius) {
    deactivateTransitionIds(getTransitionIds(select(pixelElement).attr("id"), radius))
  }

  let pixelMouseLeave = function () {
    deactivatePixel(this)
  }

  function appendPixels() {
    select(pixelCanvas)
      .selectAll("rect.pixels")
      .data(pixels, d => d.id)
      .join(enter =>
        enter
          .append("rect")
          .attr("class", "pixels")
          .attr("id", d => d.id)
          .style("stroke", "white")
          .style("fill", d => d.rgb)
          .on("mouseover", pixelMouseOver)
          .on("mouseleave", pixelMouseLeave)
      )
      .interrupt()
      .classed("non-reactive", false)
      .attr("id", d => d.id)
      .attr("x", d => d.x * pixelWidth)
      .attr("y", d => d.y * pixelHeight)
      .attr("width", pixelWidth)
      .attr("height", pixelHeight)
      .attr("transform", null)
      .style("opacity", 1)
      .style("stroke-width", 0.075)
  }

  function getPixelFromPoint(event) {
    if (!pixelCanvas || !pixelWidth || !pixelHeight) {
      return undefined
    }

    let svgBounds = event.currentTarget.getBoundingClientRect()
    let x = Math.floor((event.clientX - svgBounds.left) / pixelWidth)
    let y = Math.floor((event.clientY - svgBounds.top) / pixelHeight)

    if (x < 0 || y < 0 || x >= pixelColumnCount || y >= pixelRowCount) {
      return undefined
    }

    let pixelId = "x" + String(x + 1) + "y" + String(y + 1)

    return pixelIds.has(pixelId) ? pixelCanvas.querySelector("#" + pixelId) : undefined
  }

  function updateActivePointerPixel(event) {
    let pixelElement = getPixelFromPoint(event)

    if (pixelElement !== activePointerPixel) {
      if (activePointerPixel) {
        deactivatePixel(activePointerPixel)
      }
      activePointerPixel = pixelElement
    }

    if (activePointerPixel) {
      activatePixel(activePointerPixel)
    }
  }

  function isPrimaryTouchPointer(event) {
    return event.isPrimary && ["pen", "touch"].includes(event.pointerType)
  }

  function handlePixelPointerDown(event) {
    if (!isPrimaryTouchPointer(event) || activePointerId !== undefined || !getPixelFromPoint(event)) {
      return
    }

    activePointerId = event.pointerId
    activePointerTarget = event.currentTarget
    activePointerTarget.setPointerCapture?.(activePointerId)
    updateActivePointerPixel(event)
  }

  function handlePixelPointerMove(event) {
    if (event.pointerId !== activePointerId) {
      return
    }

    event.preventDefault()
    updateActivePointerPixel(event)
  }

  function releaseActivePointer() {
    if (activePointerPixel) {
      deactivatePixel(activePointerPixel)
    }
    if (activePointerId !== undefined && activePointerTarget?.hasPointerCapture?.(activePointerId)) {
      activePointerTarget.releasePointerCapture(activePointerId)
    }
    activePointerId = undefined
    activePointerPixel = undefined
    activePointerTarget = undefined
  }

  function handlePixelPointerUp(event) {
    if (event.pointerId !== activePointerId) {
      return
    }

    updateActivePointerPixel(event)
    releaseActivePointer()
  }

  function handlePixelPointerCancel(event) {
    if (event.pointerId === activePointerId) {
      releaseActivePointer()
    }
  }

  $: {
    if (width && height && profilePhoto && pixelCanvas) {
      pixelWidth = width / pixelColumnCount
      imgHeightDifference = Math.max(height - profilePhoto.clientHeight, 0)
      pixelHeight = (height - imgHeightDifference) / pixelRowCount
      appendPixels()
    }
  }

  // Credit is due to this blocks page for the process defined below: http://bl.ocks.org/mrtriangle/11222485
  // I took what was there and made adjustments based on preference and version differences, but the basic foundation was all set up on that page.
  let executeLaserEye = function (i, cxInput, cyInput) {
    let circles = select(laserEyeCanvas)
      .append("circle")
      .attr("cx", cxInput)
      .attr("cy", cyInput)
      .attr("r", 0.25)
      .style("fill", "transparent")
      .style("stroke", "#cc0000")
      .style("stroke-width", 7.5)

    circles
      .transition()
      // This delay is increasingly long for each circle.
      // Additional seconds keep the eyes red for a few seconds before transitioning.
      .delay(i * 225 + 500)
      .duration(3000)
      .attr("r", 300)
      .style("stroke-width", 0)
      .style("stroke-opacity", 0)
      .on("end", () => circles.remove())
  }

  let executeLaserEyes = function () {
    Array.from({ length: 4 }, (_, index) => index).forEach(i => {
      // Appending two laser eyes, each with manually input x/y values.
      executeLaserEye(i, width * 0.44, (height - imgHeightDifference) * 0.5)
      executeLaserEye(i, width * 0.6125, (height - imgHeightDifference) * 0.49)
    })
  }

  function stopLaserEyes() {
    if (laserEyesTimer) {
      laserEyesTimer.stop()
      laserEyesTimer = undefined
    }
  }

  function stopAutoTransition({ resetPixels = false } = {}) {
    if (autoTransitionFrame) {
      cancelAnimationFrame(autoTransitionFrame)
      autoTransitionFrame = undefined
    }
    autoTransitionPaths.forEach(path => deactivateTransitionIds(path.activeSliceIds))
    autoTransitionPaths = []
    autoTransitionLastStepTime = undefined
    autoTransitionKey = undefined

    if (resetPixels && pixelCanvas) {
      appendPixels()
    }
  }

  function getPixelSelector(x, y) {
    let id = "x" + String(x + 1) + "y" + String(y + 1)

    return pixelIds.has(id) ? "#" + id : undefined
  }

  function getAutoTransitionSliceIds(points) {
    return points.map(({ x, y }) => getPixelSelector(x, y)).filter(Boolean)
  }

  function createVerticalAutoTransitionFramesSlice({ x, minY, maxY, cornerIndex }) {
    return {
      cornerIndex,
      ids: getAutoTransitionSliceIds(Array.from({ length: maxY - minY + 1 }, (_, index) => ({ x, y: minY + index })))
    }
  }

  function createHorizontalAutoTransitionFramesSlice({ minX, maxX, y, cornerIndex }) {
    return {
      cornerIndex,
      ids: getAutoTransitionSliceIds(Array.from({ length: maxX - minX + 1 }, (_, index) => ({ x: minX + index, y })))
    }
  }

  function rotateAutoTransitionFramesSlices(slices, cornerIndex) {
    let startIndex = slices.findIndex(slice => slice.cornerIndex == cornerIndex)

    if (startIndex <= 0) {
      return slices
    }

    return [...slices.slice(startIndex), ...slices.slice(0, startIndex)]
  }

  function createAutoTransitionFramesSlices({ cornerIndex, maxX, maxY, minX, minY, ringWidth }) {
    let slices = []

    for (let x = minX; x <= maxX; x += 1) {
      slices.push(
        createVerticalAutoTransitionFramesSlice({
          cornerIndex: x == minX ? 0 : x == maxX ? 1 : undefined,
          maxY: minY + ringWidth - 1,
          minY,
          x
        })
      )
    }

    for (let y = minY + ringWidth; y <= maxY; y += 1) {
      slices.push(
        createHorizontalAutoTransitionFramesSlice({
          cornerIndex: y == maxY ? 2 : undefined,
          maxX,
          minX: maxX - ringWidth + 1,
          y
        })
      )
    }

    for (let x = maxX - ringWidth; x >= minX; x -= 1) {
      slices.push(
        createVerticalAutoTransitionFramesSlice({
          cornerIndex: x == minX ? 3 : undefined,
          maxY,
          minY: maxY - ringWidth + 1,
          x
        })
      )
    }

    for (let y = maxY - ringWidth; y >= minY + ringWidth; y -= 1) {
      slices.push(createHorizontalAutoTransitionFramesSlice({ maxX: minX + ringWidth - 1, minX, y }))
    }

    return rotateAutoTransitionFramesSlices(
      slices.filter(slice => slice.ids.length),
      cornerIndex
    )
  }

  function createAutoTransitionFramesPaths(cornerIndex) {
    let baseRingWidth = getTransitionRegionWidth()
    let minDimension = Math.min(pixelColumnCount, pixelRowCount)
    let ringCount = Math.ceil(minDimension / (baseRingWidth * 2))

    if (!ringCount) {
      return []
    }

    let paths = Array.from({ length: ringCount }, (_, index) => {
      let inset = index * baseRingWidth
      let remainingSize = minDimension - inset * 2
      let ringWidth = index == ringCount - 1 ? Math.ceil(remainingSize / 2) : baseRingWidth
      let minX = inset
      let minY = inset
      let maxX = pixelColumnCount - 1 - inset
      let maxY = pixelRowCount - 1 - inset
      let pathCornerIndex = index % 2 ? (cornerIndex + 2) % 4 : cornerIndex

      return {
        activeSliceIds: [],
        activeSliceIndex: undefined,
        cornerIndex: pathCornerIndex,
        maxX,
        maxY,
        minX,
        minY,
        ringWidth,
        slices: createAutoTransitionFramesSlices({ cornerIndex: pathCornerIndex, maxX, maxY, minX, minY, ringWidth })
      }
    })

    return paths
  }

  function createAutoTransitionDiagonalPaths(cornerIndex) {
    let mirrorX = cornerIndex == 1 || cornerIndex == 2
    let mirrorY = cornerIndex == 2 || cornerIndex == 3
    let diagonalIds = Array.from({ length: pixelColumnCount + pixelRowCount - 1 }, () => [])

    pixels.forEach(({ x, y, id }) => {
      let diagonalX = mirrorX ? pixelColumnCount - 1 - x : x
      let diagonalY = mirrorY ? pixelRowCount - 1 - y : y

      diagonalIds[diagonalX + diagonalY].push("#" + id)
    })

    return [
      {
        activeSliceIds: [],
        activeSliceIndex: undefined,
        slices: diagonalIds.filter(ids => ids.length).map(ids => ({ ids }))
      }
    ]
  }

  function advanceAutoTransition(timestamp) {
    if (
      autoTransitionPaths.length &&
      (autoTransitionLastStepTime === undefined || timestamp - autoTransitionLastStepTime >= autoTransitionStepInterval)
    ) {
      autoTransitionLastStepTime = timestamp

      autoTransitionPaths.forEach(path => {
        let sliceIndex = path.activeSliceIndex === undefined ? 0 : (path.activeSliceIndex + 1) % path.slices.length

        deactivateTransitionIds(path.activeSliceIds)
        path.activeSliceIndex = sliceIndex
        path.activeSliceIds = activateTransitionIds(path.slices[sliceIndex].ids)
      })
    }

    autoTransitionFrame = requestAnimationFrame(advanceAutoTransition)
  }

  function startAutoTransition(nextAutoTransitionKey) {
    if (autoTransitionFrame && autoTransitionKey == nextAutoTransitionKey) {
      return
    }

    stopAutoTransition({ resetPixels: true })
    autoTransitionKey = nextAutoTransitionKey
    autoTransitionPaths = isAutoTransitionDiagonal
      ? createAutoTransitionDiagonalPaths(Math.floor(Math.random() * 4))
      : createAutoTransitionFramesPaths(Math.floor(Math.random() * 4))
    autoTransitionFrame = requestAnimationFrame(advanceAutoTransition)
  }

  function setModeValue(value) {
    stopAutoTransition({ resetPixels: isAutoTransition })
    releaseActivePointer()
    sliderValue = value
    revealedPixelIds = new Set()
    stopLaserEyes()

    if (modeItems[value]?.value == "reveal_my_laser_vision") {
      // The timer is slightly longer than the final laser eye circle's total transition time.
      laserEyesTimer = interval(executeLaserEyes, 3000)
    }
    if (pixelCanvas) {
      appendPixels()
    }
  }

  function handleModeValueChange({ detail: e }) {
    let nextModeValue = getModeValue(e.d?.value)

    if (nextModeValue >= 0) {
      setModeValue(nextModeValue)
    }
  }

  $: if (forcedMode && forcedModeValue >= 0 && sliderValue != forcedModeValue) {
    setModeValue(forcedModeValue)
  }

  $: if (
    isAutoTransition &&
    !prefersReducedMotion &&
    pixelCanvas &&
    pixelWidth &&
    pixelHeight &&
    autoTransitionConfigKey
  ) {
    startAutoTransition(autoTransitionConfigKey)
  }

  $: if (!isAutoTransition || prefersReducedMotion) {
    stopAutoTransition({ resetPixels: isAutoTransition })
  }

  onMount(() => {
    let reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let updatePrefersReducedMotion = () => (prefersReducedMotion = reducedMotionQuery.matches)

    updatePrefersReducedMotion()
    reducedMotionQuery.addEventListener("change", updatePrefersReducedMotion)

    return () => reducedMotionQuery.removeEventListener("change", updatePrefersReducedMotion)
  })

  onDestroy(() => {
    stopAutoTransition({ resetPixels: true })
    stopLaserEyes()
    releaseActivePointer()
  })
</script>

<div class="mb-8 flex flex-col items-center">
  <div class="w-fit max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img bind:this={profilePhoto} src={profilePhotoSrc} alt="Charlie Yaris" />
  </div>
  <!-- Touch and pen drags do not mouseover sibling SVG rects, so map the point to the pixel grid instead. -->
  <svg
    class="absolute overflow-visible"
    id="profile_photo"
    style="touch-action: none;"
    class:non-reactive={isAutoTransition}
    {width}
    {height}
    on:pointerdown={handlePixelPointerDown}
    on:pointermove={handlePixelPointerMove}
    on:pointerup={handlePixelPointerUp}
    on:pointercancel={handlePixelPointerCancel}
  >
    <g bind:this={laserEyeCanvas}></g>
    <g bind:this={pixelCanvas}></g>
  </svg>
  {#if laserEyeCanvas && pixelCanvas}
    {#if showModeSelection}
      <div class="mt-2 flex flex-col items-center">
        <Select
          wrapperClasses="w-80 text-sm"
          value={modeSelectValue}
          items={modeItems}
          clearable={false}
          searchable={false}
          centeredValue={true}
          centeredItems={true}
          on:valueChange={handleModeValueChange}
        />
      </div>
    {/if}
    {#if !isAutoTransition}
      <div class="mt-4 flex flex-col items-center">
        <div class="text-xl">Hover on my face!</div>
        {#if !isTransitionMode}
          <div class="w-64">
            <ProgressBar
              value={revealedPixelRatio * 100}
              addPercentSign={true}
              label="Pixels Revealed"
              decimalPlaces={1}
              definition="Can you reveal 90%?"
              {progressBarColorScale}
            />
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <Loading classes="mt-6 h-12 w-12" image="circle" />
  {/if}
</div>
{#if laserEyeCanvas && pixelCanvas && !isTransitionMode}
  <div class="non-reactive fixed left-0 top-0">
    {#key sliderValue}
      <FireworkShow fireworkShow={revealedPixelRatio >= fireworkRevealTrigger} />
    {/key}
  </div>
{/if}
