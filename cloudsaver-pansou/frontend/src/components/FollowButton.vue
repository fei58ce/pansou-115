<template>
  <button
    v-if="link"
    class="follow-button"
    :class="{ 'follow-button--compact': compact }"
    type="button"
    title="添加到我的追更"
    @click.stop="open"
  >
    {{ compact ? "追更" : "关注追更" }}
  </button>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
const props = defineProps<{
  resource: { title: string; cloudLinks: string[] };
  compact?: boolean;
}>();
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
/* 手机端根字号被放大过，这里只用 px */
.follow-button {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  color: var(--green-700);
  background: var(--green-100);
  border: 1.5px solid var(--line-soft);
  border-radius: var(--radius-sketch-pill);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: var(--weight-medium);
  line-height: 1;
  white-space: nowrap;
  transition: var(--theme-transition);
}

.follow-button:hover {
  border-color: var(--line);
}

.follow-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.follow-button--compact {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}
</style>
