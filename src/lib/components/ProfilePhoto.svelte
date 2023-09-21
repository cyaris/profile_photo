<script>
  import * as d3 from "d3"

  import { Slider } from "svelte-lib/components"
  import { FireworkShow } from "fireworks/components"
  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"
  import relativeTransitionIds from "../static/relative_transition_pixels.json"

  let width
  let height
  let pixelWidth
  let pixelHeight
  // TODO: fix bug where img renders at 5px less than height variable.
  let imgHeightDifference
  $: {
    if (width && height) {
      pixelWidth = width / Math.max(...pixels.map(v => v.x + 1))
      let clientHeight = d3.select("#profilePhoto").node().clientHeight
      imgHeightDifference = Math.max(height - d3.select("#profilePhoto").node().clientHeight, 0)
      pixelHeight = (height - imgHeightDifference) / Math.max(...pixels.map(v => v.y + 1))
      appendPixels()
    }
  }

  function appendPixels() {
    d3.select("#pixel_canvas")
      .selectAll()
      .data(pixels)
      .enter()
      .append("rect")
      .attr("class", "pixels")
      .attr("id", d => d.id)
      .attr("x", d => d.x * pixelWidth)
      .attr("y", d => d.y * pixelHeight)
      .attr("width", pixelWidth)
      .attr("height", pixelHeight)
      .style("stroke", "white")
      .style("stroke-width", 0.075)
      .style("fill", d => d.rgb)
      .on("mouseover", pixelMouseOver)
      .on("mouseleave", pixelMouseLeave)
  }

  let transitionDelay = 100
  let transitionDuration = 750
  let revealed = []
  let pixelMouseOver = function (d) {
    let transitionIds = getTransitionIds(d3.select(this).attr("id")).filter(v => !d3.select(v).classed("non-reactive"))

    if (transitionIds.length) {
      if (sliderValue !== 2) {
        revealed = [...revealed, ...transitionIds]
      }
      d3.select("#pixel_canvas")
        .selectAll(transitionIds.join(", "))
        .classed("non-reactive", true)
        .style("stroke-width", 0.3)
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .attr("x", d => d.x * pixelWidth)
        .attr("y", d => d.y * pixelHeight)
        .attr("width", pixelWidth / 1.5)
        .attr("height", pixelHeight / 1.5)
        .attr("transform", d => "rotate(45," + d.x * pixelWidth + "," + d.y * pixelHeight + ")")
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .style("opacity", 0)
    }
  }

  let pixelMouseLeave = function (d) {
    // mouseleave function is only needed for transition mode because otherwise the pixel will be removed.
    if (sliderValue == 2) {
      let transitionIds = getTransitionIds(d3.select(this).attr("id"))

      if (transitionIds.length) {
        let rects = d3.select("#pixel_canvas").selectAll(transitionIds.join(", "))

        rects
          .transition()
          .delay(transitionDelay * 2 + transitionDuration * 2 + 500)
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

  function getTransitionIds(id) {
    let x = parseInt(id.split("y")[0].substring(1))
    let y = parseInt(id.split("y")[1])

    return relativeTransitionIds
      .map(v => "#x" + String(v.x + x) + "y" + String(v.y + y))
      .filter(v => !d3.select(v).empty())
  }

  // credit is due to this blocks page for the process defined below: http://bl.ocks.org/mrtriangle/11222485
  // I took what was there and made adjustments launchXLocd on preference and version differences, but the basic foundation was all set up on that page.
  let executeLaserEyes = function (d) {
    Array.from({ length: 4 }, (_, index) => index).forEach(i => {
      // appending two laser eyes, each with manually inputted x/y values.
      createLaserEyeWave(i, width * 0.44, (height - imgHeightDifference) * 0.5)
      createLaserEyeWave(i, width * 0.6125, (height - imgHeightDifference) * 0.49)
    })
  }

  let createLaserEyeWave = function (i, cxInput, cyInput) {
    let circles = d3
      .select("#laser_eye_canvas")
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

  let items = [
    { value: "reveal", label: "Reveal" },
    { value: "reveal_my_laser_vision", label: "Reveal My Laser Vision" },
    { value: "transition", label: "Transition" },
  ]

  let sliderValue = 0
  let laserEyesTimer
</script>

<div class="flex flex-col items-center">
  <div class="w-fit max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img id="profilePhoto" src={profilePhotoSrc} />
  </div>
  <svg class="absolute overflow-visible" id="profile_photo" {width} {height}>
    <g id="laser_eye_canvas"></g>
    <g id="pixel_canvas"></g>
  </svg>
  <div class="flex flex-col items-center mt-4">
    <Slider
      wrapperClasses="w-80 text-sm"
      value={sliderValue}
      {items}
      min={0}
      max={2}
      hoverable={false}
      springValues={{ stiffness: 1, damping: 1 }}
      on:valueChange={({ detail: e }) => {
        sliderValue = e.d
        revealed = []
        if (sliderValue == 1) {
          // manually inputting a number slightly larger the how long it will take for final laser eye circle will finish transition (delay included).
          // the final transition was calculated by adding the delay from the highest i value with the duration seconds.
          laserEyesTimer = d3.interval(executeLaserEyes, 3000)
        } else if (laserEyesTimer) {
          laserEyesTimer.stop()
        }
        d3.selectAll(".pixels").remove()
        appendPixels()
      }}
    />
  </div>

  <div class="flex flex-col items-center mt-4">
    <div class="text-xl">Hover on my face!</div>
    {#if sliderValue !== 2}
      <div class="mt-1">
        Percent revealed: {((revealed.length / pixels.length) * 100).toFixed(1).replace(/\.0+$/, "")}%
      </div>
    {/if}
  </div>
</div>
{#if sliderValue !== 2 && revealed.length / pixels.length >= 0.9}
  <div class="non-reactive fixed top-0 left-0">
    <FireworkShow />
  </div>
{/if}
