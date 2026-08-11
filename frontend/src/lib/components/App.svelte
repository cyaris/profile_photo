<script>
  import "d3-transition"

  import { select } from "d3-selection"
  import { interval } from "d3-timer"
  import { FireworkShow } from "fireworks/components"
  import { onDestroy, onMount } from "svelte"
  import { Loading, ProgressBar, Select } from "svelte-lib/components"
  import { getCanvasPointerPoint } from "svelte-lib/functions/canvas"

  import {
    activatePixelIndexes,
    createAutoTransitionDiagonalPaths,
    createAutoTransitionFramePaths,
    createPixelModel,
    createPixelStates,
    createRevealFlags,
    createTransitionNeighborhoods,
    deactivatePixelIndexes,
    drawPixelCanvas,
    getPixelIndexFromPoint,
    getPixelNeighborhood,
    transitionDuration
  } from "../profilePhotoPixels.js"
  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"

  export let forcedMode = undefined
  export let showModeSelection = true
  export let transitionPixelRadius = 2

  const {
    cellPixelIndexes,
    columnCount: pixelColumnCount,
    pixelRecords,
    rowCount: pixelRowCount
  } = createPixelModel(pixels)
  const modeItems = [
    { value: "reveal", label: "Reveal" },
    { value: "reveal_my_laser_vision", label: "Reveal My Laser Vision" },
    { value: "transition", label: "Transition" },
    { value: "auto_transition_frames", label: "Auto Transition (Frames)" },
    { value: "auto_transition_diagonal", label: "Auto Transition (Diagonal)" }
  ]
  const progressBarColorScale = () => "#006D2C"
  const fireworkRevealTrigger = 0.9

  function getModeValue(mode) {
    return modeItems.findIndex(item => item.value == mode)
  }

  let displayWidth
  let displayHeight
  let pixelCanvas
  let laserEyeCanvas
  let profilePhoto
  let profilePhotoNaturalWidth = pixelColumnCount
  let profilePhotoNaturalHeight = pixelRowCount

  let pixelStates = createPixelStates(pixelRecords.length)
  let revealedPixels = createRevealFlags(pixelRecords.length)
  let revealedPixelCount = 0
  let sliderValue = Math.max(getModeValue(forcedMode), 0)
  let modeSelectValue = modeItems[sliderValue]
  let laserEyesTimer
  let activePointerId
  let activePointerPixelIndex
  let activePointerTarget
  let autoTransitionFrame
  let autoTransitionPaths = []
  let autoTransitionLastStepTime
  let autoTransitionKey
  let prefersReducedMotion = false
  let renderFrame
  let isDestroyed = false

  export let autoTransitionStepDuration = transitionDuration / 32

  $: revealedPixelRatio = revealedPixelCount / pixelRecords.length
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
  $: transitionNeighborhoods = createTransitionNeighborhoods({
    cellPixelIndexes,
    columnCount: pixelColumnCount,
    radius: transitionPixelRadius,
    rowCount: pixelRowCount
  })
  $: geometry =
    displayWidth && displayHeight
      ? {
          width: displayWidth,
          height: displayHeight,
          cellWidth: displayWidth / pixelColumnCount,
          cellHeight: displayHeight / pixelRowCount,
          sourceWidth: profilePhotoNaturalWidth,
          sourceHeight: profilePhotoNaturalHeight
        }
      : undefined
  $: geometryKey = geometry ? [geometry.width, geometry.height, pixelColumnCount, pixelRowCount].join(":") : undefined
  $: autoTransitionConfigKey = [
    activeMode,
    transitionPixelRadius,
    autoTransitionStepInterval,
    pixelColumnCount,
    pixelRowCount
  ].join(":")
  $: isProfileReady = pixelCanvas && laserEyeCanvas && geometry

  function scheduleRender() {
    if (!isDestroyed && !renderFrame) {
      renderFrame = requestAnimationFrame(renderPixels)
    }
  }

  function renderPixels(timestamp) {
    renderFrame = undefined

    if (!pixelCanvas || !geometry) {
      return
    }

    if (drawPixelCanvas({ canvas: pixelCanvas, geometry, pixels: pixelRecords, states: pixelStates, timestamp })) {
      scheduleRender()
    }
  }

  function revealPixel(index) {
    if (revealedPixels[index]) return

    revealedPixels[index] = 1
    revealedPixelCount += 1
  }

  function resetPixels() {
    pixelStates = createPixelStates(pixelRecords.length)
    revealedPixels = createRevealFlags(pixelRecords.length)
    revealedPixelCount = 0
    scheduleRender()
  }

  function getPixelNeighborhoodIndexes(pixelIndex) {
    return getPixelNeighborhood({
      columnCount: pixelColumnCount,
      neighborhoods: transitionNeighborhoods,
      pixel: pixelRecords[pixelIndex]
    })
  }

  function activatePixelIndex(pixelIndex) {
    if (pixelIndex === undefined) return []

    let activatedIndexes = activatePixelIndexes({
      indexes: getPixelNeighborhoodIndexes(pixelIndex),
      isTransitionMode,
      now: performance.now(),
      onRevealPixel: revealPixel,
      states: pixelStates
    })

    if (activatedIndexes.length) {
      scheduleRender()
    }

    return activatedIndexes
  }

  function deactivatePixelIndex(pixelIndex) {
    if (pixelIndex === undefined) return

    deactivatePixelIndexes({
      indexes: getPixelNeighborhoodIndexes(pixelIndex),
      isTransitionMode,
      now: performance.now(),
      states: pixelStates
    })
    scheduleRender()
  }

  function getPointerPixelIndex(event) {
    return getPixelIndexFromPoint({
      cellPixelIndexes,
      columnCount: pixelColumnCount,
      point: getCanvasPointerPoint(pixelCanvas, event),
      rowCount: pixelRowCount
    })
  }

  function updateActivePointerPixel(event) {
    let pixelIndex = getPointerPixelIndex(event)

    if (pixelIndex !== activePointerPixelIndex) {
      deactivatePixelIndex(activePointerPixelIndex)
      activePointerPixelIndex = pixelIndex
      activatePixelIndex(activePointerPixelIndex)
    }
  }

  function isPrimaryTouchPointer(event) {
    return event.isPrimary && ["pen", "touch"].includes(event.pointerType)
  }

  function isMousePointer(event) {
    return event.pointerType == "mouse" || event.pointerType == ""
  }

  function handlePixelPointerDown(event) {
    if (!isPrimaryTouchPointer(event) || activePointerId !== undefined || getPointerPixelIndex(event) === undefined) {
      return
    }

    activePointerId = event.pointerId
    activePointerTarget = event.currentTarget
    activePointerTarget.setPointerCapture?.(activePointerId)
    updateActivePointerPixel(event)
  }

  function handlePixelPointerMove(event) {
    if (event.pointerId === activePointerId) {
      event.preventDefault()
      updateActivePointerPixel(event)
    } else if (activePointerId === undefined && isMousePointer(event)) {
      updateActivePointerPixel(event)
    }
  }

  function releaseActivePointer() {
    deactivatePixelIndex(activePointerPixelIndex)

    if (activePointerId !== undefined && activePointerTarget?.hasPointerCapture?.(activePointerId)) {
      activePointerTarget.releasePointerCapture(activePointerId)
    }

    activePointerId = undefined
    activePointerPixelIndex = undefined
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

  function handlePixelPointerLeave(event) {
    if (activePointerId === undefined && isMousePointer(event)) {
      releaseActivePointer()
    }
  }

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
      .delay(i * 225 + 500)
      .duration(3000)
      .attr("r", 300)
      .style("stroke-width", 0)
      .style("stroke-opacity", 0)
      .on("end", () => circles.remove())
  }

  let executeLaserEyes = function () {
    if (!displayWidth || !displayHeight || !laserEyeCanvas) return

    Array.from({ length: 4 }, (_, index) => index).forEach(i => {
      executeLaserEye(i, displayWidth * 0.44, displayHeight * 0.5)
      executeLaserEye(i, displayWidth * 0.6125, displayHeight * 0.49)
    })
  }

  function stopLaserEyes() {
    if (laserEyesTimer) {
      laserEyesTimer.stop()
      laserEyesTimer = undefined
    }
  }

  function stopAutoTransition({ reset = false } = {}) {
    if (autoTransitionFrame) {
      cancelAnimationFrame(autoTransitionFrame)
      autoTransitionFrame = undefined
    }

    autoTransitionPaths = []
    autoTransitionLastStepTime = undefined
    autoTransitionKey = undefined

    if (reset) {
      resetPixels()
    }
  }

  function advanceAutoTransition(timestamp) {
    if (
      autoTransitionPaths.length &&
      (autoTransitionLastStepTime === undefined || timestamp - autoTransitionLastStepTime >= autoTransitionStepInterval)
    ) {
      autoTransitionLastStepTime = timestamp

      autoTransitionPaths.forEach(path => {
        let sliceIndex = path.activeSliceIndex === undefined ? 0 : (path.activeSliceIndex + 1) % path.slices.length

        deactivatePixelIndexes({
          indexes: path.activeIndexes,
          isTransitionMode: true,
          now: timestamp,
          states: pixelStates
        })
        path.activeSliceIndex = sliceIndex
        path.activeIndexes = activatePixelIndexes({
          indexes: path.slices[sliceIndex].indexes,
          isTransitionMode: true,
          now: timestamp,
          states: pixelStates
        })
      })
      scheduleRender()
    }

    autoTransitionFrame = requestAnimationFrame(advanceAutoTransition)
  }

  function startAutoTransition(nextAutoTransitionKey) {
    if (autoTransitionFrame && autoTransitionKey == nextAutoTransitionKey) {
      return
    }

    stopAutoTransition({ reset: true })
    autoTransitionKey = nextAutoTransitionKey
    autoTransitionPaths = isAutoTransitionDiagonal
      ? createAutoTransitionDiagonalPaths({
          columnCount: pixelColumnCount,
          cornerIndex: Math.floor(Math.random() * 4),
          pixels: pixelRecords,
          rowCount: pixelRowCount
        })
      : createAutoTransitionFramePaths({
          cellPixelIndexes,
          columnCount: pixelColumnCount,
          cornerIndex: Math.floor(Math.random() * 4),
          radius: transitionPixelRadius,
          rowCount: pixelRowCount
        })
    autoTransitionFrame = requestAnimationFrame(advanceAutoTransition)
  }

  function setModeValue(value) {
    stopAutoTransition()
    releaseActivePointer()
    sliderValue = value
    resetPixels()
    stopLaserEyes()

    if (modeItems[value]?.value == "reveal_my_laser_vision") {
      laserEyesTimer = interval(executeLaserEyes, 3000)
    }
  }

  function handleModeValueChange({ detail: e }) {
    let nextModeValue = getModeValue(e.d?.value)

    if (nextModeValue >= 0) {
      setModeValue(nextModeValue)
    }
  }

  function updateProfilePhotoDimensions() {
    profilePhotoNaturalWidth = profilePhoto?.naturalWidth || pixelColumnCount
    profilePhotoNaturalHeight = profilePhoto?.naturalHeight || pixelRowCount
    scheduleRender()
  }

  $: if (pixelCanvas && geometryKey) {
    scheduleRender()
  }

  $: if (forcedMode && forcedModeValue >= 0 && sliderValue != forcedModeValue) {
    setModeValue(forcedModeValue)
  }

  $: if (isAutoTransition && !prefersReducedMotion && pixelCanvas && geometry && autoTransitionConfigKey) {
    startAutoTransition(autoTransitionConfigKey)
  }

  $: if (!isAutoTransition || prefersReducedMotion) {
    stopAutoTransition({ reset: isAutoTransition })
  }

  onMount(() => {
    let reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let updatePrefersReducedMotion = () => (prefersReducedMotion = reducedMotionQuery.matches)

    updatePrefersReducedMotion()
    reducedMotionQuery.addEventListener("change", updatePrefersReducedMotion)

    return () => reducedMotionQuery.removeEventListener("change", updatePrefersReducedMotion)
  })

  onDestroy(() => {
    isDestroyed = true

    if (renderFrame) {
      cancelAnimationFrame(renderFrame)
    }

    stopAutoTransition({ reset: true })
    stopLaserEyes()
    releaseActivePointer()
  })
</script>

<div class="mb-8 flex flex-col items-center">
  <div class="relative w-fit max-w-md" bind:clientWidth={displayWidth} bind:clientHeight={displayHeight}>
    <img
      bind:this={profilePhoto}
      class="block h-auto max-w-full"
      src={profilePhotoSrc}
      alt="Charlie Yaris"
      on:load={updateProfilePhotoDimensions}
    />
    <canvas
      bind:this={pixelCanvas}
      class="absolute left-0 top-0 h-full w-full"
      class:non-reactive={isAutoTransition}
      style="touch-action: none;"
      aria-hidden="true"
      on:pointerdown={handlePixelPointerDown}
      on:pointermove={handlePixelPointerMove}
      on:pointerup={handlePixelPointerUp}
      on:pointercancel={handlePixelPointerCancel}
      on:pointerleave={handlePixelPointerLeave}
    ></canvas>
    <svg class="pointer-events-none absolute left-0 top-0 overflow-visible" width={displayWidth} height={displayHeight}>
      <g bind:this={laserEyeCanvas}></g>
    </svg>
  </div>
  {#if isProfileReady}
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
{#if isProfileReady && !isTransitionMode}
  <div class="non-reactive fixed left-0 top-0">
    {#key sliderValue}
      <FireworkShow fireworkShow={revealedPixelRatio >= fireworkRevealTrigger} />
    {/key}
  </div>
{/if}
