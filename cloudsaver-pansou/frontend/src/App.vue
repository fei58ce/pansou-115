<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from "element-plus/es/locale/lang/zh-cn";
</script>

<style>
#app {
  height: 100vh;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
html,
body {
  margin: 0;
  font-size: 15px;
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text-primary);
  background-color: var(--surface);
  word-wrap: break-word;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  position: fixed;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-name: none !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

/* 温柔线描插画的轻动效：只移动素材本身，不改变布局；系统关闭动效时由上面的规则完全停用。 */
@keyframes moe-line-float {
  0%,
  100% {
    translate: 0 0;
    rotate: -0.4deg;
  }

  50% {
    translate: 0 -6px;
    rotate: 0.4deg;
  }
}

@keyframes moe-line-breathe {
  0%,
  100% {
    scale: 0.98;
  }

  50% {
    scale: 1.02;
  }
}

.moe-animate--float,
.moe-animate--breathe,
.el-empty__image img {
  transform-origin: center bottom;
  will-change: translate, rotate, scale;
}

.moe-animate--float,
.el-empty__image img {
  animation: moe-line-float 6s ease-in-out infinite;
}

.moe-animate--breathe {
  animation: moe-line-breathe 5s ease-in-out infinite;
}

input {
  border: none;
  outline: none;
}

/* 移动端全局样式 */
@media screen and (max-width: 768px) {
  #app {
    max-width: 100vw;
    overflow-x: hidden;
  }

  /* 统一按钮样式：小号按钮保留自己的尺寸，圆角按钮保留圆角；用 :where 把优先级压到和 .van-button 一样，页面里自己写的按钮样式才能覆盖 */
  .van-button:where(:not(.van-button--mini, .van-button--small)) {
    height: 40px;
    font-size: var(--font-size-base);
  }

  .van-button:where(:not(.van-button--mini, .van-button--small, .van-button--round)) {
    border-radius: var(--border-radius-base);
  }

  /* 统一输入框样式 */
  .van-field {
    font-size: var(--font-size-base);
  }

  /* 统一卡片样式 */
  .van-card {
    border-radius: var(--border-radius-base);
    margin: var(--spacing-base) 0;
  }
}
</style>
