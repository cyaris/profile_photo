<script>
  import { interval } from "d3-timer"
  import { FireworkShow } from "fireworks/components"
  import { onDestroy, onMount } from "svelte"
  import { Loading, ProgressBar, Select, Toggle } from "svelte-lib/components"
  import { createAnimationLoop } from "svelte-lib/functions"
  import { getCanvasPointerPoint } from "svelte-lib/functions/canvas"

  import { createLaserEyeBurst, drawLaserEyeCanvas, laserEyeRadiusScale } from "../laserEye.js"
  import {
    activatePixelIndexes,
    advanceAutoTransitionPath,
    createAutoTransitionDiagonalPaths,
    createAutoTransitionFramePaths,
    createPixelModel,
    createPixelStates,
    createRevealFlags,
    createTransitionNeighborhoods,
    deactivatePixelIndexes,
    drawPixelCanvas,
    getAutoTransitionPixelHiddenDuration,
    getGridLinePixelIndexes,
    getPixelIndexFromPoint,
    getPixelNeighborhood,
    transitionReuseDuration
  } from "../profilePhotoPixels.js"
  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"

  export let autoTransitionSetDelay = undefined
  export let autoTransitionSetDuration = undefined
  export let forcedMode = undefined
  export let showModeSelection = true
  export let transitionPixelRadius = 2

  const {
    cellPixelIndexes,
    columnCount: pixelColumnCount,
    pixelRecords,
    rowCount: pixelRowCount
  } = createPixelModel(pixels)
  const defaultAutoTransitionStepDuration = 1000 / 30
  const modeItems = [
    { value: "reveal", label: "Reveal" },
    { value: "transition", label: "Transition" },
    { value: "auto_transition_frames", label: "Auto Transition (Frames)" },
    { value: "auto_transition_diagonal", label: "Auto Transition (Diagonal)" }
  ]
  const progressBarColorScale = () => "#1b998b"
  const fireworkRevealTrigger = 0.9
  // favicon.png's actual pixel dimensions, not the pixelation grid's column/row count.
  const profilePhotoNaturalSize = 400

  $: autoTransitionSetStepCount = {
    frames: Math.max(
      ...createAutoTransitionFramePaths({
        cellPixelIndexes,
        columnCount: pixelColumnCount,
        cornerIndex: 0,
        radius: transitionPixelRadius,
        rowCount: pixelRowCount
      }).map(path => path.slices.length)
    ),
    diagonal: createAutoTransitionDiagonalPaths({
      columnCount: pixelColumnCount,
      cornerIndex: 0,
      pixels: pixelRecords,
      rowCount: pixelRowCount
    })[0].slices.length
  }
  $: defaultAutoTransitionSetDuration = {
    frames: (autoTransitionSetStepCount.frames - 1) * defaultAutoTransitionStepDuration,
    diagonal: (autoTransitionSetStepCount.diagonal - 1) * defaultAutoTransitionStepDuration
  }

  function getModeValue(mode) {
    return modeItems.findIndex(item => item.value == mode)
  }

  function getDefaultAutoTransitionSetDelay(modeKey, stepCount, stepInterval) {
    if (modeKey == "frames") return 0

    return (
      transitionReuseDuration -
      (stepCount.diagonal - 2) * stepInterval +
      getAutoTransitionPixelHiddenDuration(stepInterval)
    )
  }

  let displayWidth
  let displayHeight
  let pixelCanvas
  let laserEyeCanvas
  let pixelStates = createPixelStates(pixelRecords.length)
  let revealedPixels = createRevealFlags(pixelRecords.length)
  let revealedPixelCount = 0
  let sliderValue = Math.max(getModeValue(forcedMode), 0)
  let modeSelectValue = modeItems[sliderValue]
  let laserEyesTimer
  let laserEyeCircles = []
  let laserVisionEnabled = false
  let activePointerId
  let activePointerPixelIndex
  let activePointerTarget
  let activePointerNeighborhoodIndexes = new Set()
  let autoTransitionPaths = []
  let autoTransitionNextStepTime
  let autoTransitionKey
  let prefersReducedMotion = false
  let isDestroyed = false

  $: revealedPixelRatio = revealedPixelCount / pixelRecords.length
  $: activeMode = modeItems[sliderValue]?.value ?? modeItems[0].value
  $: modeSelectValue = modeItems[sliderValue] ?? modeItems[0]
  $: forcedModeValue = getModeValue(forcedMode)
  $: isAutoTransitionFrames = activeMode == "auto_transition_frames"
  $: isAutoTransitionDiagonal = activeMode == "auto_transition_diagonal"
  $: isAutoTransition = isAutoTransitionFrames || isAutoTransitionDiagonal
  $: isTransitionMode = activeMode == "transition" || isAutoTransition
  $: autoTransitionModeKey = isAutoTransitionDiagonal ? "diagonal" : "frames"
  $: configuredAutoTransitionSetDuration = autoTransitionSetDuration?.[autoTransitionModeKey]
  $: configuredAutoTransitionSetDelay = autoTransitionSetDelay?.[autoTransitionModeKey]
  $: resolvedAutoTransitionSetDuration = Number.isFinite(configuredAutoTransitionSetDuration)
    ? Math.max(configuredAutoTransitionSetDuration, 1)
    : defaultAutoTransitionSetDuration[autoTransitionModeKey]
  $: autoTransitionStepInterval = Math.max(
    resolvedAutoTransitionSetDuration / Math.max(autoTransitionSetStepCount[autoTransitionModeKey] - 1, 1),
    1
  )
  $: resolvedAutoTransitionSetDelay = Number.isFinite(configuredAutoTransitionSetDelay)
    ? Math.max(configuredAutoTransitionSetDelay, 0)
    : getDefaultAutoTransitionSetDelay(autoTransitionModeKey, autoTransitionSetStepCount, autoTransitionStepInterval)
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
          overflow: Math.max(displayWidth, displayHeight) / 8
        }
      : undefined
  $: canvasOverflow = geometry?.overflow ?? 0
  $: canvasWidth = geometry ? geometry.width + canvasOverflow * 2 : undefined
  $: canvasHeight = geometry ? geometry.height + canvasOverflow * 2 : undefined
  $: geometryKey = geometry ? [geometry.width, geometry.height, pixelColumnCount, pixelRowCount].join(":") : undefined
  $: autoTransitionConfigKey = [
    activeMode,
    transitionPixelRadius,
    autoTransitionStepInterval,
    resolvedAutoTransitionSetDelay,
    pixelColumnCount,
    pixelRowCount
  ].join(":")
  $: isProfileReady = pixelCanvas && laserEyeCanvas && geometry
  $: laserEyeOverflow = displayWidth ? displayWidth * laserEyeRadiusScale : 0

  function renderPixels(timestamp) {
    if (!pixelCanvas || !geometry) return false

    return drawPixelCanvas({ canvas: pixelCanvas, geometry, pixels: pixelRecords, states: pixelStates, timestamp })
  }

  let pixelAnimationLoop = createAnimationLoop(renderPixels)

  function scheduleRender() {
    if (!isDestroyed) pixelAnimationLoop.start()
  }

  function laserEyeFrame(timestamp) {
    let result = drawLaserEyeCanvas({
      canvas: laserEyeCanvas,
      circles: laserEyeCircles,
      height: displayHeight,
      overflow: laserEyeOverflow,
      timestamp,
      width: displayWidth
    })

    laserEyeCircles = result.circles

    return result.hasActive
  }

  let laserEyeAnimationLoop = createAnimationLoop(laserEyeFrame)

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
    if (pixelIndex === undefined) return []

    return getPixelNeighborhood({
      columnCount: pixelColumnCount,
      neighborhoods: transitionNeighborhoods,
      pixel: pixelRecords[pixelIndex]
    })
  }

  function getPointerPixelIndex(event) {
    return getPixelIndexFromPoint({
      cellPixelIndexes,
      columnCount: pixelColumnCount,
      point: getCanvasPointerPoint(pixelCanvas, event, { offsetX: canvasOverflow, offsetY: canvasOverflow }),
      rowCount: pixelRowCount
    })
  }

  function getPointerPathIndexes(pixelIndex) {
    if (pixelIndex === undefined) return []

    return getGridLinePixelIndexes({
      cellPixelIndexes,
      columnCount: pixelColumnCount,
      fromPixel: pixelRecords[activePointerPixelIndex],
      rowCount: pixelRowCount,
      toPixel: pixelRecords[pixelIndex]
    })
  }

  function updateActivePointerPixel(event) {
    if (event.currentTarget.classList.contains("non-reactive")) return

    let pixelIndex = getPointerPixelIndex(event)

    if (pixelIndex === activePointerPixelIndex) return

    let nextIndexSet = new Set(getPointerPathIndexes(pixelIndex).flatMap(getPixelNeighborhoodIndexes))

    deactivatePixelIndexes({
      indexes: [...activePointerNeighborhoodIndexes].filter(index => !nextIndexSet.has(index)),
      isTransitionMode,
      now: performance.now(),
      states: pixelStates
    })
    activatePixelIndexes({
      indexes: [...nextIndexSet].filter(index => !activePointerNeighborhoodIndexes.has(index)),
      isTransitionMode,
      now: performance.now(),
      onRevealPixel: revealPixel,
      states: pixelStates
    })

    activePointerNeighborhoodIndexes = nextIndexSet
    activePointerPixelIndex = pixelIndex
    scheduleRender()
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
    deactivatePixelIndexes({
      indexes: [...activePointerNeighborhoodIndexes],
      isTransitionMode,
      now: performance.now(),
      states: pixelStates
    })
    scheduleRender()

    if (activePointerId !== undefined && activePointerTarget?.hasPointerCapture?.(activePointerId)) {
      activePointerTarget.releasePointerCapture(activePointerId)
    }

    activePointerId = undefined
    activePointerPixelIndex = undefined
    activePointerNeighborhoodIndexes = new Set()
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

  function executeLaserEyes() {
    if (!displayWidth || !displayHeight || !laserEyeCanvas) return

    laserEyeCircles = [
      ...laserEyeCircles,
      ...createLaserEyeBurst({ displayHeight, displayWidth, now: performance.now() })
    ]
    laserEyeAnimationLoop.start()
  }

  function stopLaserEyes() {
    if (laserEyesTimer) {
      laserEyesTimer.stop()
      laserEyesTimer = undefined
    }

    laserEyeAnimationLoop.stop()
    laserEyeCircles = []

    if (laserEyeCanvas) {
      drawLaserEyeCanvas({
        canvas: laserEyeCanvas,
        circles: [],
        height: displayHeight,
        overflow: laserEyeOverflow,
        timestamp: performance.now(),
        width: displayWidth
      })
    }
  }

  function handleLaserVisionChange({ detail }) {
    laserVisionEnabled = detail.checked

    if (laserVisionEnabled) {
      executeLaserEyes()
      laserEyesTimer = interval(executeLaserEyes, 3000)
    } else {
      stopLaserEyes()
    }
  }

  function advanceAutoTransition(timestamp) {
    if (
      autoTransitionPaths.length &&
      (autoTransitionNextStepTime === undefined || timestamp >= autoTransitionNextStepTime)
    ) {
      let currentStepTime = autoTransitionNextStepTime ?? timestamp

      if (timestamp - currentStepTime >= autoTransitionStepInterval) {
        currentStepTime = timestamp
      }

      autoTransitionNextStepTime = currentStepTime + autoTransitionStepInterval

      autoTransitionPaths.forEach(path => {
        let minimumSetDelay = Math.max(
          transitionReuseDuration - (path.slices.length - 2) * autoTransitionStepInterval,
          0
        )

        advanceAutoTransitionPath({
          path,
          now: currentStepTime,
          setDelay: Math.max(resolvedAutoTransitionSetDelay, minimumSetDelay),
          states: pixelStates
        })
      })
      scheduleRender()
    }

    return true
  }

  let autoTransitionAnimationLoop = createAnimationLoop(advanceAutoTransition)

  function stopAutoTransition({ reset = false } = {}) {
    autoTransitionAnimationLoop.stop()
    autoTransitionPaths = []
    autoTransitionNextStepTime = undefined
    autoTransitionKey = undefined

    if (reset) {
      resetPixels()
    }
  }

  function startAutoTransition(nextAutoTransitionKey) {
    if (autoTransitionKey == nextAutoTransitionKey) {
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
    autoTransitionAnimationLoop.start()
  }

  function setModeValue(value) {
    stopAutoTransition()
    releaseActivePointer()
    sliderValue = value
    resetPixels()
  }

  function handleModeValueChange({ detail: e }) {
    let nextModeValue = getModeValue(e.d?.value)

    if (nextModeValue >= 0) {
      setModeValue(nextModeValue)
    }
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

    pixelAnimationLoop.stop()
    stopAutoTransition({ reset: true })
    stopLaserEyes()
    releaseActivePointer()
  })
</script>

<div class="mb-8 flex flex-col items-center">
  <div
    class="relative w-fit max-w-md"
    class:non-reactive={isAutoTransition}
    style:touch-action="pinch-zoom"
    bind:clientWidth={displayWidth}
    bind:clientHeight={displayHeight}
    on:pointerdown={handlePixelPointerDown}
    on:pointermove={handlePixelPointerMove}
    on:pointerup={handlePixelPointerUp}
    on:pointercancel={handlePixelPointerCancel}
    on:pointerleave={handlePixelPointerLeave}
  >
    <img
      class="block h-auto max-w-full"
      src={profilePhotoSrc}
      alt="Charlie Yaris"
      width={profilePhotoNaturalSize}
      height={profilePhotoNaturalSize}
      on:load={scheduleRender}
    />
    <canvas
      bind:this={laserEyeCanvas}
      class="pointer-events-none absolute"
      style:left="{-laserEyeOverflow}px"
      style:top="{-laserEyeOverflow}px"
      style:width="{displayWidth + laserEyeOverflow * 2}px"
      style:height="{displayHeight + laserEyeOverflow * 2}px"
      style:z-index={60}
      aria-hidden="true"
    ></canvas>
    <canvas
      bind:this={pixelCanvas}
      class="pointer-events-none absolute"
      style:left="{-canvasOverflow}px"
      style:top="{-canvasOverflow}px"
      style:width="{canvasWidth}px"
      style:height="{canvasHeight}px"
      style:z-index={70}
      aria-hidden="true"
    ></canvas>
  </div>
  {#if isProfileReady}
    {#if showModeSelection || !isAutoTransition}
      <div class="mt-4 flex flex-col items-center gap-2">
        {#if showModeSelection}
          <Select
            wrapperClasses="w-64"
            value={modeSelectValue}
            items={modeItems}
            clearable={false}
            searchable={false}
            centeredValue={true}
            centeredItems={true}
            on:valueChange={handleModeValueChange}
          />
          <Toggle
            checked={laserVisionEnabled}
            label="Laser Vision"
            wrapperClasses="w-64"
            on:change={handleLaserVisionChange}
          />
        {/if}
        {#if !isAutoTransition}
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
        {/if}
      </div>
    {/if}
  {:else}
    <Loading classes="mt-6 h-12 w-12" image="circle" />
  {/if}
</div>
{#if isProfileReady && !isTransitionMode}
  <div class="non-reactive pointer-events-none fixed left-0 top-0 z-[100]">
    {#key sliderValue}
      <FireworkShow fireworkShow={revealedPixelRatio >= fireworkRevealTrigger} />
    {/key}
  </div>
{/if}
