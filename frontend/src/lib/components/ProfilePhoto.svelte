<script>
  import "d3-transition"

  import { scaleLinear } from "d3-scale"
  import { select } from "d3-selection"
  import { interval } from "d3-timer"
  import { FireworkShow } from "fireworks/components"
  import { onDestroy } from "svelte"
  import { GaugeChart, Loading, Slider } from "svelte-lib/components"

  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"

  export let transitionPixelRadius = 2

  const pixelColumnCount = Math.max(...pixels.map(v => v.x + 1))
  const pixelRowCount = Math.max(...pixels.map(v => v.y + 1))
  const pixelIds = new Set(pixels.map(v => v.id))

  function getRelativeTransitionIds(radius) {
    let roundedRadius = Math.max(Math.floor(radius), 0)

    return Array.from({ length: roundedRadius * 2 + 1 }, (_, xIndex) =>
      Array.from({ length: roundedRadius * 2 + 1 }, (_, yIndex) => ({
        x: xIndex - roundedRadius,
        y: yIndex - roundedRadius
      }))
    ).flat()
  }

  $: relativeTransitionIds = getRelativeTransitionIds(transitionPixelRadius)

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
  let transitionDuration = 750
  let revealed = []
  let sliderValue = 0
  let laserEyesTimer
  let activePointerId
  let activePointerPixel
  let activePointerTarget

  const gaugeColorScale = scaleLinear().domain([0, 1]).range(["#F7FCF5", "#006D2C"]).clamp(true)

  const fireworkRevealTrigger = 0.9

  function getTransitionIds(id) {
    let x = parseInt(id.split("y")[0].substring(1))
    let y = parseInt(id.split("y")[1])

    return relativeTransitionIds
      .map(v => "#x" + String(v.x + x) + "y" + String(v.y + y))
      .filter(v => pixelIds.has(v.slice(1)))
  }

  function activatePixel(pixelElement) {
    if (select(pixelElement).classed("non-reactive")) {
      return
    }

    let transitionIds = getTransitionIds(select(pixelElement).attr("id")).filter(
      v => !select(v).classed("non-reactive")
    )

    if (transitionIds.length) {
      if (sliderValue !== 2) {
        revealed = [...revealed, ...transitionIds]
      }
      select(pixelCanvas)
        .selectAll(transitionIds.join(", "))
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
  }

  let pixelMouseOver = function () {
    activatePixel(this)
  }

  function deactivatePixel(pixelElement) {
    // mouseleave function is only needed for transition mode because otherwise the pixel will be removed.
    if (sliderValue == 2) {
      let transitionIds = getTransitionIds(select(pixelElement).attr("id"))

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

    let pixelId = "x" + String(x) + "y" + String(y)

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

  // credit is due to this blocks page for the process defined below: http://bl.ocks.org/mrtriangle/11222485
  // I took what was there and made adjustments launchXLocd on preference and version differences, but the basic foundation was all set up on that page.
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
      // this delay is increasingly long for each circle
      // additional seconds are added so that the eyes are stay red for a few seconds before transitioning
      .delay(i * 225 + 500)
      .duration(3000)
      .attr("r", 300)
      .style("stroke-width", 0)
      .style("stroke-opacity", 0)
      .on("end", () => circles.remove())
  }

  let executeLaserEyes = function () {
    Array.from({ length: 4 }, (_, index) => index).forEach(i => {
      // appending two laser eyes, each with manually inputted x/y values.
      executeLaserEye(i, width * 0.44, (height - imgHeightDifference) * 0.5)
      executeLaserEye(i, width * 0.6125, (height - imgHeightDifference) * 0.49)
    })
  }

  let items = [
    { value: "reveal", label: "Reveal" },
    { value: "reveal_my_laser_vision", label: "Reveal My Laser Vision" },
    { value: "transition", label: "Transition" }
  ]

  function stopLaserEyes() {
    if (laserEyesTimer) {
      laserEyesTimer.stop()
      laserEyesTimer = undefined
    }
  }

  function handleSliderValueChange({ detail: e }) {
    sliderValue = e.d
    revealed = []
    stopLaserEyes()

    if (sliderValue == 1) {
      // manually inputting a number slightly larger the how long it will take for final laser eye circle will finish transition (delay included).
      // the final transition was calculated by adding the delay from the highest i value with the duration seconds.
      laserEyesTimer = interval(executeLaserEyes, 3000)
    }
    appendPixels()
  }

  onDestroy(() => {
    stopLaserEyes()
    releaseActivePointer()
  })
</script>

<div class="flex flex-col items-center">
  <div class="w-fit max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img bind:this={profilePhoto} src={profilePhotoSrc} alt="Charlie Yaris" />
  </div>
  <!-- Touch and pen drags do not mouseover sibling SVG rects, so map the point to the pixel grid instead. -->
  <svg
    class="absolute overflow-visible"
    id="profile_photo"
    style="touch-action: none;"
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
    <div class="mt-2 flex flex-col items-center">
      <Slider
        wrapperClasses="w-80 text-sm"
        value={sliderValue}
        {items}
        min={0}
        max={2}
        hoverable={false}
        springValues={{ stiffness: 1, damping: 1 }}
        on:valueChange={handleSliderValueChange}
      />
    </div>
    <div class="mt-4 flex flex-col items-center">
      <div class="text-xl">Hover on my face!</div>
      {#if sliderValue !== 2}
        <div class="w-52">
          <GaugeChart
            value={(revealed.length / pixels.length) * 100}
            addPercentSign={true}
            title="Pixels Revealed"
            titlePosition="bottom"
            decimalPlaces={1}
            titleClasses="text-xl"
            textClasses="font-normal"
            definition="Can you reveal 90%?"
            {gaugeColorScale}
          />
        </div>
      {/if}
    </div>
  {:else}
    <Loading classes="mt-6 h-12 w-12" image="circle" />
  {/if}
</div>
{#if sliderValue !== 2 && revealed.length / pixels.length >= fireworkRevealTrigger}
  <div class="non-reactive fixed left-0 top-0">
    <FireworkShow />
  </div>
{/if}
