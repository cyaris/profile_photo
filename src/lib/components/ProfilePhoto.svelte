<script>
  import profilePhotoSrc from "../static/profile_photo.png"
  import pixels from "../static/proile_photo_pixel_rgb_codes.json"
  import hoverSections from "../static/proile_photo_hover_sections.json"

  console.log(pixels)
  let width
  let height
  let pixelWidth
  let pixelHeight
  $: {
    if (width && height) {
      pixelWidth = width / (Math.max(...pixels.map(v => v.x)) + 1)
      pixelHeight = height / (Math.max(...pixels.map(v => v.y)) + 1)
    }
  }
</script>

<div class="flex flex-col items-center">
  <div class="flex-col w-fit h-full max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img src={profilePhotoSrc} />
  </div>
  {#if pixelWidth && pixelHeight}
    <svg class="absolute" id="profile_photo" {width} {height}>
      {#each pixels as pixel}
        <rect
          x={pixel.x * pixelWidth}
          y={pixel.y * pixelHeight}
          width={pixelWidth}
          height={pixelHeight}
          fill={pixel.rgb}
          stroke="white"
          stroke-width={0.075}
        />
      {/each}
    </svg>
  {/if}
</div>
