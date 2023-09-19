<script>
  import * as d3 from "d3"

  import { Slider } from "svelte-lib/components"
  import profilePhotoSrc from "../static/favicon.png"
  import pixels from "../static/pixels.json"
  import relativeTransitionIds from "../static/relative_transition_pixels.json"

  let width
  let height
  let pixelWidth
  let pixelHeight
  $: {
    if (width && height) {
      pixelWidth = width / Math.max(...pixels.map(v => v.x + 1))
      pixelHeight = height / Math.max(...pixels.map(v => v.y + 1))

      d3.select("#profile_photo")
        .selectAll()
        .data(pixels)
        .enter()
        .append("rect")
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
  }

  let transitionDelay = 100
  let transitionDuration = 750
  let transitionLength = transitionDelay * 2 + transitionDuration * 2

  let pixelMouseOver = function (d) {
    let transitionIds = getTransitionIds(d3.select(this).attr("id")).filter(v => !d3.select(v).classed("non-reactive"))

    if (transitionIds.length) {
      d3.select("#profile_photo")
        .selectAll(transitionIds.join(", "))
        .classed("non-reactive", true)
        .style("stroke-width", 0.3)
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .attr("x", d => d.x * pixelWidth + 1.5)
        .attr("y", d => d.y * pixelHeight - 1)
        .attr("width", pixelWidth / 1.5)
        .attr("height", pixelHeight / 1.5)
        .attr(
          "transform",
          d =>
            "rotate(45," +
            (d.x * pixelWidth + (pixelWidth - pixelWidth / 1.5) / 2) +
            "," +
            (d.y * pixelHeight + (pixelHeight - pixelHeight / 1.5)) +
            ")"
        )
        .transition()
        .delay(transitionDelay)
        .duration(transitionDuration)
        .style("opacity", 0)

      if (sliderValue == 2) {
        d3.timeout(
          () => {
            d3.select("#profile_photo").selectAll(transitionIds.join(", ")).classed("non-reactive", false)
          },
          (transitionDelay + transitionDuration) * 2
        )
      }
    }
  }

  let pixelMouseLeave = function (d) {
    // mouseleave function is only needed for transition mode because otherwise the pixel will be removed.
    if (sliderValue == 2) {
      let transitionIds = getTransitionIds(d3.select(this).attr("id"))

      if (transitionIds.length) {
        d3.select("#profile_photo")
          .selectAll(transitionIds.join(", "))
          .transition()
          .delay(transitionLength + 500)
          .duration(transitionDuration)
          .attr("x", d => d.x * pixelWidth)
          .attr("y", d => d.y * pixelHeight)
          .attr("width", pixelWidth)
          .attr("height", pixelHeight)
          .attr(
            "transform",
            d =>
              "rotate(0," +
              (d.x * pixelWidth + (pixelWidth - pixelWidth / 1.5) / 2) +
              "," +
              (d.y * pixelHeight + (pixelHeight - pixelHeight / 1.5)) +
              ")"
          )
          .style("opacity", 1)
          .transition()
          // .delay(transitionDelay)
          .duration(transitionDuration)
          .style("stroke-width", 0.075)
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

  let items = [
    { value: "reveal", label: "Reveal" },
    { value: "reveal_my_laser_vision", label: "Reveal My Laser Vision" },
    { value: "transition", label: "Transition" },
  ]

  let sliderValue = 0
</script>

<div class="flex flex-col items-center">
  <div class="flex-col w-fit max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img src={profilePhotoSrc} />
  </div>
  <svg class="absolute" id="profile_photo" {width} {height} />
  <div class="flex flex-col items-center mt-4">
    <Slider
      wrapperClasses="w-96 text-sm"
      value={sliderValue}
      {items}
      min={0}
      max={2}
      hoverable={false}
      on:valueChange={({ detail: e }) => (sliderValue = e.d)}
    />
  </div>
</div>
