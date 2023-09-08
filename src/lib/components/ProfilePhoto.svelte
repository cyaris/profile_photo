<script>
  let width
  let height
</script>

<div class="flex flex-col items-center">
  <div class="flex-col w-fit h-full max-w-md" bind:clientWidth={width} bind:clientHeight={height}>
    <img src="https://s3.us-east-2.amazonaws.com/cyaris.github.io/profile_photo/profile_photo.png" />
  </div>
  <svg class="absolute" id="profile_photo" {width} {height}>
    <rect x={0} y={0} {width} {height} fill="transparent" stroke="red" stroke-width={10} />
  </svg>
</div>
