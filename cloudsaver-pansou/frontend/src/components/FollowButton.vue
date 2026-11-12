<template>
  <button v-if="link" class="follow-button" type="button" @click.stop="open">关注追更</button>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
const props = defineProps<{ resource: { title: string; cloudLinks: string[] } }>();
const router = useRouter();
const link = computed(() =>
  props.resource.cloudLinks?.find((s) =>
    /^https:\/\/(115|115cdn|anxia)\.com\/s\/[a-z0-9]+/i.test(s)
  )
);
const open = () =>
  router.push({
    path: "/subscriptions",
    query: { share: link.value, title: props.resource.title },
  });
</script>
<style scoped>
.follow-button {
  padding: 0.4em 0.7em;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 0.5em;
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  white-space: nowrap;
}
</style>
