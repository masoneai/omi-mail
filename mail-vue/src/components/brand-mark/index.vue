<template>
  <img class="omi-brand-mark" src="/omi-mark.svg" :width="size" :height="size"
       :alt="decorative ? '' : 'Omi Mail'" :aria-hidden="decorative ? true : undefined" />
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 40 },
  decorative: { type: Boolean, default: true },
})
</script>

<style scoped>
.omi-brand-mark { display: block; flex-shrink: 0; aspect-ratio: 1; object-fit: contain; }
</style>
