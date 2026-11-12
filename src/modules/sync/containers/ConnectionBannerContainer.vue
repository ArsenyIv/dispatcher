<script setup lang="ts">
import { storeToRefs } from 'pinia'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import { useConnectionStore } from '../store/connectionStore'

const { status } = storeToRefs(useConnectionStore())
</script>

<template>
  <ConnectionBanner :status="status" />
</template>