<template>
  <RouterView />
</template>

<script setup>
import { onMounted } from 'vue'
import { useScheduleStore } from '@/stores/schedule'

const store = useScheduleStore()

onMounted(async () => {
  await Promise.all([store.fetchItems(), store.fetchCategories()])
})
</script>
