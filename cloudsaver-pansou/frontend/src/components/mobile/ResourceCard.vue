<template>
  <div class="resource-card">
    <article
      v-for="(item, index) in dataList"
      :key="resourceKey(item, index)"
      class="m-item"
      :class="{ 'is-bad': item.linkStatus === 'bad' }"
    >
      <div class="m-item__main">
        <div class="m-item__cover">
          <van-image v-if="item.image" :src="getProxyImageUrl(item.image)" fit="cover" lazy-load />
          <span v-else class="cover-placeholder" :data-type="item.cloudType">
            {{ cloudTypeLabel(item.cloudType) }}
          </span>
        </div>

        <div class="m-item__info">
          <div class="m-item__meta">
            <span class="badge badge--type" :data-type="item.cloudType">
              {{ cloudTypeLabel(item.cloudType) }}
            </span>
            <span
              v-if="item.linkStatus"
              class="badge"
              :class="`badge--${LINK_STATUS_TONE[item.linkStatus]}`"
            >
              {{ LINK_STATUS_LABEL[item.linkStatus] }}
            </span>
            <span v-if="item.sourceName" class="m-item__source">来自 {{ item.sourceName }}</span>
          </div>

          <!-- 点标题复制链接 -->
          <div class="m-item__title" @click="copyUrl(item.cloudLinks[0])">
            {{ item.title }}
          </div>

          <!-- 点描述展开 / 收起 -->
          <div
            v-if="htmlToText(item.content)"
            class="m-item__desc"
            :class="{ 'is-expanded': expandedItems[resourceKey(item, index)] }"
            @click="toggleExpand(resourceKey(item, index))"
          >
            {{ htmlToText(item.content) }}
          </div>

          <div v-if="item.tags?.length" class="m-item__tags">
            <span
              v-for="tag in item.tags.slice(0, 4)"
              :key="tag"
              class="tag"
              @click.stop="searchMovieforTag(tag)"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div class="m-item__actions">
        <FollowButton compact :resource="item" />
        <span class="actions__spacer" />
        <van-button size="small" plain @click="handleJump(item)">打开</van-button>
        <van-button v-if="item.isSupportMagnet" size="small" plain @click="handleCopyMagnet(item)">
          复制磁力
        </van-button>
        <van-button
          v-if="item.isSupportMagnet"
          size="small"
          type="warning"
          @click="handle115Lixian(item)"
        >
          115离线
        </van-button>
        <van-button v-if="item.isSupportSave" size="small" type="primary" @click="handleSave(item)">
          转存
        </van-button>
      </div>
    </article>

    <div v-if="group" class="resource-card__end">
      <van-loading v-if="group.loading" size="16px">加载中…</van-loading>
      <template v-else-if="hasMorePages">滑到底部自动加载更多</template>
      <template v-else>共 {{ dataList.length }} 条</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import FollowButton from "@/components/FollowButton.vue";
import { computed, ref } from "vue";
import { useResourceStore } from "@/stores/resource";
import type { ResourceItem } from "@/types";
import { getProxyImageUrl } from "@/utils/image";
import { copyText, copyMagnet } from "@/utils/magnet";
import {
  LINK_STATUS_LABEL,
  LINK_STATUS_TONE,
  cloudTypeLabel,
  htmlToText,
  isTelegramGroup,
  resourceKey,
} from "@/utils/resource";

const props = defineProps<{
  currentChannelId: string;
}>();

const emit = defineEmits<{
  (e: "save", resource: ResourceItem): void;
  (e: "jump", resource: ResourceItem): void;
  (e: "searchMovieforTag", tag: string): void;
  (e: "lixian", resource: ResourceItem): void;
}>();

const store = useResourceStore();

const group = computed(() => store.resources.find((item) => item.id === props.currentChannelId));
const dataList = computed(() => group.value?.list || []);
// PanSou 分组和 115 汇总一次就是全部，TG 频道到底前都能继续翻
const hasMorePages = computed(() => {
  const last = dataList.value[dataList.value.length - 1];
  return isTelegramGroup(group.value?.id || "") && !last?.isLastMessage;
});

const handleSave = (resource: ResourceItem) => {
  emit("save", resource);
};

const handleJump = (resource: ResourceItem) => {
  emit("jump", resource);
};

const copyUrl = async (url: string) => {
  await copyText(url, "链接已复制到剪贴板");
};

const handleCopyMagnet = (resource: ResourceItem) => {
  const magnet = store.extractMagnets(resource)[0];
  copyMagnet(magnet);
};

/** 交给父组件选目录后提交 115 离线 */
const handle115Lixian = (resource: ResourceItem) => {
  emit("lixian", resource);
};

const searchMovieforTag = (tag: string) => {
  emit("searchMovieforTag", tag);
};

const expandedItems = ref<Record<string, boolean>>({});

const toggleExpand = (id: string) => {
  expandedItems.value[id] = !expandedItems.value[id];
};
</script>

<style lang="scss" scoped>
.resource-card {
  padding: 4px 12px 0;

  &__end {
    display: flex;
    justify-content: center;
    padding: 8px 0 16px;
    color: var(--text-tertiary);
    font-size: 12px;
  }
}

.m-item {
  margin-bottom: 10px;
  padding: 12px;
  background: var(--surface-raised);
  border-radius: 12px;
  box-shadow: var(--shadow-1);

  &.is-bad {
    opacity: 0.6;
  }

  &__main {
    display: flex;
    gap: 12px;
  }

  &__cover {
    flex: none;
    width: 72px;
    height: 100px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--grey-100);

    :deep(.van-image) {
      width: 100%;
      height: 100%;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__source {
    align-self: center;
    min-width: 0;
    overflow: hidden;
    color: var(--text-tertiary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: anywhere;

    &:active {
      opacity: 0.7;
    }
  }

  &__desc {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    color: var(--text-tertiary);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-line;
    overflow-wrap: anywhere;

    &.is-expanded {
      -webkit-line-clamp: 12;
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;

    .tag {
      color: var(--primary-600);
      font-size: 12px;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);

    .actions__spacer {
      flex: 1;
    }

    .van-button {
      height: 28px;
      margin: 0;
      padding: 0 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .van-button--plain {
      color: var(--text-secondary);
      border-color: var(--border-strong);
    }
  }
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 15px;
  font-weight: 600;
  color: var(--primary-400);
  background: linear-gradient(160deg, var(--primary-50), var(--primary-100));

  &[data-type="magnet"],
  &[data-type="ed2k"] {
    color: var(--amber-500);
    background: linear-gradient(160deg, hsl(43, 100%, 96%), var(--amber-100));
  }

  &[data-type="quark"] {
    color: var(--violet-500);
    background: linear-gradient(160deg, hsl(262, 90%, 98%), var(--violet-100));
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--grey-100);
  color: var(--grey-600);

  &--success {
    background: var(--green-100);
    color: var(--green-700);
  }

  &--warning {
    background: var(--amber-100);
    color: var(--amber-700);
  }

  &--danger {
    background: var(--red-100);
    color: var(--red-700);
  }

  &--type {
    background: var(--primary-50);
    color: var(--primary-700);

    &[data-type="magnet"],
    &[data-type="ed2k"] {
      background: var(--amber-100);
      color: var(--amber-700);
    }

    &[data-type="quark"] {
      background: var(--violet-100);
      color: var(--violet-700);
    }
  }
}
</style>
