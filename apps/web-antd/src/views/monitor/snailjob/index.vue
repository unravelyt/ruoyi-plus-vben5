<script setup lang="ts">
import { computed } from 'vue';

// 直接从环境变量读取IP配置
const adminUrl = computed(() => {
  const adminIP = import.meta.env.VITE_ADMIN_IP || '127.0.0.1';
  return `http://${adminIP}:8000/job`;
});
</script>

<!-- 建议通过菜单配置成外链/内嵌 达到相同的效果且灵活性更高 -->
<template>
  <iframe class="size-full" :src="adminUrl"></iframe>
</template>
