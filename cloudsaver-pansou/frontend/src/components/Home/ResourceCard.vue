<template>
  <div class="resource-card">
    <!-- 详情弹窗 -->
    <el-dialog
      v-model="showDetail"
      :title="currentResource?.title"
      width="680px"
      class="resource-detail-dialog"
      destroy-on-close
    >
      <div v-if="currentResource" class="detail">
        <div class="detail__cover">
          <img
            v-if="currentResource.image"
            :src="getProxyImageUrl(currentResource.image)"
            alt=""
            referrerpolicy="no-referrer"
          />
          <span v-else class="cover-placeholder" :data-type="currentResource.cloudType">
            {{ cloudTypeLabel(currentResource.cloudType) }}
          </span>
        </div>
        <div class="detail__info">
          <div class="item-meta">
            <span class="badge badge--type" :data-type="currentResource.cloudType">
              {{ cloudTypeLabel(currentResource.cloudType) }}
            </span>
            <span
              v-if="currentResource.linkStatus"
              class="badge"
              :class="`badge--${LINK_STATUS_TONE[currentResource.linkStatus]}`"
            >
              {{ LINK_STATUS_LABEL[currentResource.linkStatus] }}
            </span>
            <span v-if="formatDate(currentResource.pubDate)" class="item-date">
              {{ formatDate(currentResource.pubDate) }}
            </span>
          </div>
          <p class="detail__desc">{{ htmlToText(currentResource.content) || "没有更多说明" }}</p>
          <div v-if="currentResource.tags?.length" class="item-tags">
            <button
              v-for="tag in currentResource.tags"
              :key="tag"
              type="button"
              class="tag"
              @click="searchMovieforTag(tag)"
            >
              {{ tagLabel(tag) }}
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <div v-if="currentResource" class="item-actions item-actions--dialog">
          <FollowButton :resource="currentResource" />
          <el-button @click="handleJump(currentResource)">打开链接</el-button>
          <el-button
            v-if="currentResource.isSupportMagnet"
            @click="handleCopyMagnet(currentResource)"
          >
            复制磁力
          </el-button>
          <el-button
            v-if="currentResource.isSupportMagnet"
            type="warning"
            @click="handle115Lixian(currentResource)"
          >
            115离线
          </el-button>
          <el-button
            v-if="currentResource.isSupportSave"
            type="primary"
            @click="handleSave(currentResource)"
          >
            转存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <section v-for="group in store.resources" :key="group.id" class="resource-group">
      <header class="group-header" @click="group.displayList = !group.displayList">
        <span class="group-avatar" :class="{ 'group-avatar--115': group.id === SUMMARY_115_ID }">
          <img v-if="group.id === SUMMARY_115_ID" :src="iconCloudBox" alt="" />
          <img
            v-else-if="group.channelInfo.channelLogo"
            :src="getProxyImageUrl(group.channelInfo.channelLogo)"
            alt=""
            loading="lazy"
          />
          <template v-else>{{ group.channelInfo.name.slice(0, 1) }}</template>
        </span>
        <span class="group-name">{{ group.channelInfo.name }}</span>
        <span class="group-count">{{ group.list.length }}</span>
        <a
          v-if="isTelegramGroup(group.id)"
          class="group-link"
          :href="`https://t.me/s/${group.id}`"
          target="_blank"
          rel="noopener noreferrer"
          @click.stop
        >
          频道主页
        </a>
        <el-icon class="group-toggle" :class="{ 'is-open': group.displayList }">
          <ArrowDown />
        </el-icon>
      </header>

      <div v-if="group.displayList" class="group-body">
        <div class="card-grid">
          <article
            v-for="(resource, index) in group.list"
            :key="resourceKey(resource, index)"
            class="resource-item"
            :class="{ 'is-bad': resource.linkStatus === 'bad' }"
          >
            <div class="item-cover" @click="showResourceDetail(resource)">
              <img
                v-if="resource.image && !brokenImages.has(resource.image)"
                :src="getProxyImageUrl(resource.image)"
                :alt="resource.title"
                loading="lazy"
                @error="brokenImages.add(resource.image || '')"
              />
              <span v-else class="cover-placeholder" :data-type="resource.cloudType">
                {{ cloudTypeLabel(resource.cloudType) }}
              </span>
            </div>

            <div class="item-body">
              <div class="item-meta">
                <span class="badge badge--type" :data-type="resource.cloudType">
                  {{ cloudTypeLabel(resource.cloudType) }}
                </span>
                <span
                  v-if="resource.linkStatus"
                  class="badge"
                  :class="`badge--${LINK_STATUS_TONE[resource.linkStatus]}`"
                  :title="resource.linkStatusMessage"
                >
                  {{ LINK_STATUS_LABEL[resource.linkStatus] }}
                </span>
                <span v-if="resource.sourceName" class="item-source" :title="resource.sourceName">
                  来自 {{ resource.sourceName }}
                </span>
                <span v-if="formatDate(resource.pubDate)" class="item-date">
                  {{ formatDate(resource.pubDate) }}
                </span>
              </div>

              <a
                class="item-title"
                :href="resource.cloudLinks[0]"
                target="_blank"
                rel="noopener noreferrer"
                :title="resource.title"
              >
                {{ resource.title }}
              </a>

              <p
                v-if="htmlToText(resource.content)"
                class="item-desc"
                @click="showResourceDetail(resource)"
              >
                {{ htmlToText(resource.content) }}
              </p>

              <div v-if="resource.tags?.length" class="item-tags">
                <button
                  v-for="tag in resource.tags.slice(0, 4)"
                  :key="tag"
                  type="button"
                  class="tag"
                  @click="searchMovieforTag(tag)"
                >
                  {{ tagLabel(tag) }}
                </button>
              </div>

              <div class="item-actions">
                <el-button
                  v-if="resource.isSupportSave"
                  type="primary"
                  size="small"
                  @click="handleSave(resource)"
                >
                  转存
                </el-button>
                <el-button
                  v-if="resource.isSupportMagnet"
                  type="warning"
                  size="small"
                  @click="handle115Lixian(resource)"
                >
                  115离线
                </el-button>
                <el-button size="small" @click="handleJump(resource)">打开</el-button>
                <el-button
                  v-if="resource.isSupportMagnet"
                  size="small"
                  @click="handleCopyMagnet(resource)"
                >
                  复制磁力
                </el-button>
                <FollowButton compact :resource="resource" />
              </div>
            </div>
          </article>
        </div>

        <div v-if="isTelegramGroup(group.id)" class="load-more">
          <el-button :loading="group.loading" @click="handleLoadMore(group.id)">
            加载更多
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import FollowButton from "@/components/FollowButton.vue";
import { useResourceStore } from "@/stores/resource";
import { reactive, ref } from "vue";
import type { ResourceItem } from "@/types";
import { ArrowDown } from "@element-plus/icons-vue";
import { getProxyImageUrl } from "@/utils/image";
import { copyMagnet } from "@/utils/magnet";
import iconCloudBox from "@/assets/moe/icon-cloud-box.webp";
import {
  LINK_STATUS_LABEL,
  LINK_STATUS_TONE,
  SUMMARY_115_ID,
  cloudTypeLabel,
  htmlToText,
  isTelegramGroup,
  resourceKey,
  tagLabel,
} from "@/utils/resource";

const store = useResourceStore();

const showDetail = ref(false);
const currentResource = ref<ResourceItem | null>(null);
const brokenImages = reactive(new Set<string>());

const emit = defineEmits(["save", "loadMore", "jump", "searchMovieforTag", "lixian"]);

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getMagnet = (resource: ResourceItem) => {
  const list = store.extractMagnets(resource);
  return list[0] || "";
};

const handleSave = (resource: ResourceItem) => {
  if (showDetail.value) {
    showDetail.value = false;
  }
  emit("save", resource);
};

const handleJump = (resource: ResourceItem) => {
  emit("jump", resource);
};

const handleCopyMagnet = (resource: ResourceItem) => {
  copyMagnet(getMagnet(resource));
};

/** 交给父组件选目录后提交 115 离线 */
const handle115Lixian = (resource: ResourceItem) => {
  if (showDetail.value) {
    showDetail.value = false;
  }
  emit("lixian", resource);
};

const showResourceDetail = (resource: ResourceItem) => {
  currentResource.value = resource;
  showDetail.value = true;
};

const searchMovieforTag = (tag: string) => {
  emit("searchMovieforTag", tag);
};

const handleLoadMore = (channelId: string) => {
  emit("loadMore", channelId);
};
</script>

<style lang="scss" scoped>
.resource-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-bottom: var(--space-6);
}

// 分组
.group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  cursor: pointer;
  user-select: none;

  .group-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    overflow: hidden;
    background: var(--pink-100);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--line-soft);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    flex: none;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &--115 {
      width: 28px;
      height: 28px;
      border-radius: 0;
      background: none;
      box-shadow: none;

      img {
        object-fit: contain;
      }
    }
  }

  .group-name {
    font-size: var(--text-md);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
  }

  .group-count {
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--pink-100);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: 20px;
  }

  .group-link {
    margin-left: var(--space-1);
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    text-decoration: none;

    &:hover {
      color: var(--primary-600);
    }
  }

  .group-toggle {
    margin-left: auto;
    color: var(--text-tertiary);
    transform: rotate(-90deg);
    transition: transform var(--duration) var(--ease);

    &.is-open {
      transform: rotate(0);
    }
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--space-4);
}

// 单个资源
.resource-item {
  display: flex;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-4);
  background: var(--surface-raised);
  border: var(--line-width) solid var(--line-soft);
  border-radius: var(--radius-sketch);
  box-shadow: var(--shadow-1);
  transition:
    box-shadow var(--duration) var(--ease),
    border-color var(--duration) var(--ease);

  &:hover {
    border-color: var(--line);
    box-shadow: var(--shadow-2);
  }

  &.is-bad {
    opacity: 0.6;
  }
}

.item-cover {
  flex: none;
  width: 96px;
  height: 136px;
  border-radius: var(--radius-sketch-sm);
  overflow: hidden;
  background: var(--grey-100);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--primary-400);
  background: linear-gradient(160deg, var(--primary-50), var(--primary-100));

  &[data-type="magnet"],
  &[data-type="ed2k"] {
    color: var(--amber-500);
    background: linear-gradient(160deg, var(--grey-50), var(--amber-100));
  }

  &[data-type="quark"] {
    color: var(--violet-500);
    background: linear-gradient(160deg, var(--grey-50), var(--violet-100));
  }
}

.item-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
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

.item-source {
  min-width: 0;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.item-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  line-height: var(--leading-snug);
  text-decoration: none;
  overflow-wrap: anywhere;

  &:hover {
    color: var(--primary-600);
  }
}

.item-desc {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  white-space: pre-line;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);

  .tag {
    padding: 0;
    border: none;
    background: none;
    color: var(--primary-600);
    font-family: inherit;
    font-size: var(--text-xs);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.item-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-1);

  .el-button {
    margin: 0;
  }

  .el-button--small {
    height: 28px;
    padding: 0 var(--space-3);
  }

  &--dialog {
    justify-content: flex-end;
  }
}

.load-more {
  display: flex;
  justify-content: center;
  padding: var(--space-4) 0 0;
}

// 详情弹窗
.detail {
  display: flex;
  gap: var(--space-5);

  &__cover {
    flex: none;
    width: 150px;
    height: 216px;
    border-radius: var(--radius-sketch-sm);
    overflow: hidden;
    background: var(--grey-100);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
  }

  &__desc {
    max-height: 320px;
    margin: 0;
    overflow-y: auto;
    color: var(--text-secondary);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
}
</style>
