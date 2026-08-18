<script>
  import "svelte-lib/styles/root.css"
  import "svelte-lib/styles/app.css"

  export let params
  void params
</script>

<slot />

<style>
  :global(html) {
    overflow-x: clip;
  }
</style>
