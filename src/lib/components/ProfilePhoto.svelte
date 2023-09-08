<script>
  let width
  let height
</script>

<svelte:window bind:outerWidth={width} bind:outerHeight={height} />
<svg
  class="no_selection non_reactive overflow-visible fixed top-0 left-0 w-full h-full z-50"
  id="fireworks"
  {width}
  {height}
/>
