<template>
  <el-dialog
    v-model="visible"
    title="115 网盘扫码登录"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
    destroy-on-close
    @close="handleClose"
  >
    <div class="qrcode-login">
      <!-- 登录方式 -->
      <div class="qrcode-app-type">
        <span class="app-type-label">登录方式</span>
        <el-select
          v-model="appType"
          size="small"
          :disabled="loading || status === 'scanned'"
          @change="handleAppTypeChange"
        >
          <el-option
            v-for="opt in appOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          >
            <span>{{ opt.label }}</span>
            <span class="option-desc">{{ opt.description }}</span>
          </el-option>
        </el-select>
      </div>
      <p class="qrcode-app-hint">推荐「115_苹果端」，授权有效期更长；请使用 115 App 扫码。</p>

      <div v-if="loading && !qrcodeImage" class="qrcode-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在生成二维码...</span>
      </div>

      <template v-else>
        <!-- 二维码图片 -->
        <div class="qrcode-wrapper">
          <img v-if="qrcodeImage" :src="qrcodeImage" alt="115 登录二维码" class="qrcode-img" />
          <!-- 状态遮罩 -->
          <div v-if="status === 'expired' || status === 'canceled'" class="qrcode-mask">
            <p>{{ status === "canceled" ? "已取消扫码" : "二维码已过期" }}</p>
            <el-button type="primary" size="small" @click="initQrcode">重新获取</el-button>
          </div>
          <div v-else-if="status === 'confirmed'" class="qrcode-mask success">
            <el-icon size="36" color="#67c23a"><CircleCheckFilled /></el-icon>
            <p>登录成功</p>
          </div>
        </div>

        <!-- 状态文案 -->
        <div class="qrcode-status">
          <p v-if="status === 'pending'">
            请使用 115 App 扫描二维码登录
            <span class="app-label">（{{ selectedAppLabel }}）</span>
          </p>
          <p v-else-if="status === 'scanned'" class="status-info">
            <el-icon><InfoFilled /></el-icon>
            已扫码，请在手机上点击确认
          </p>
          <p v-else-if="status === 'confirmed'" class="status-success">
            <el-icon><CircleCheckFilled /></el-icon>
            {{ successMessage || "登录成功，Cookie 已保存" }}
          </p>
          <p v-else-if="status === 'expired'" class="status-error">
            <el-icon><WarningFilled /></el-icon>
            二维码已过期，请重新获取
          </p>
          <p v-else-if="status === 'canceled'" class="status-error">
            <el-icon><WarningFilled /></el-icon>
            已取消扫码，请重新获取
          </p>
          <p v-else-if="status === 'error'" class="status-error">
            <el-icon><WarningFilled /></el-icon>
            {{ errorMessage || "扫码异常" }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="qrcode-actions">
          <el-button
            v-if="status === 'expired' || status === 'canceled' || status === 'error'"
            type="primary"
            @click="initQrcode"
          >
            重新获取
          </el-button>
          <el-button v-else-if="status === 'confirmed'" type="primary" @click="handleSuccess">
            完成
          </el-button>
        </div>
      </template>

      <!-- 倒计时 -->
      <div v-if="status === 'pending' || status === 'scanned'" class="qrcode-timer">
        二维码有效期：{{ formatCountdown(countdown) }}
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import { Loading, InfoFilled, WarningFilled, CircleCheckFilled } from "@element-plus/icons-vue";
import {
  cloud115QrcodeApi,
  QrcodeStatus,
  Cloud115AppType,
  CLOUD115_APP_OPTIONS,
} from "@/api/cloud115Qrcode";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
  (e: "success"): void;
}>();

const visible = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => (visible.value = v)
);
watch(visible, (v) => emit("update:modelValue", v));

const appOptions = CLOUD115_APP_OPTIONS;
const appType = ref<Cloud115AppType>("115ios");
const selectedAppLabel = computed(
  () => appOptions.find((item) => item.value === appType.value)?.label || "115_苹果端"
);

const loading = ref(false);
const qrcodeImage = ref("");
const uid = ref("");
const status = ref<QrcodeStatus>("pending");
const errorMessage = ref("");
const successMessage = ref("");

let pollTimer: number | null = null;
let countdownTimer: number | null = null;
const countdown = ref(180);

const formatCountdown = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + sec.toString().padStart(2, "0");
};

const startCountdown = () => {
  countdown.value = 180;
  stopCountdown();
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      stopCountdown();
      if (status.value === "pending" || status.value === "scanned") {
        status.value = "expired";
        stopPoll();
      }
    }
  }, 1000);
};

const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

const stopPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const startPoll = () => {
  stopPoll();
  pollTimer = window.setInterval(async () => {
    if (!uid.value) return;
    try {
      const result = await cloud115QrcodeApi.check(uid.value);
      status.value = result.status;
      if (result.message) errorMessage.value = result.message;
      if (
        result.status === "confirmed" ||
        result.status === "expired" ||
        result.status === "canceled" ||
        result.status === "error"
      ) {
        stopPoll();
        if (result.status === "confirmed") {
          stopCountdown();
          successMessage.value = result.userName
            ? (result.message || "登录成功") + "，账号：" + result.userName
            : result.message || "登录成功，Cookie 已保存";
          ElMessage.success(successMessage.value);
        }
      }
    } catch (e) {
      // 静默忽略一次错误，下次轮询再试
    }
  }, 2000);
};

const initQrcode = async () => {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  status.value = "pending";
  try {
    const data = await cloud115QrcodeApi.init(appType.value);
    uid.value = data.uid;
    qrcodeImage.value = data.qrcodeImage;
    if (data.appType) appType.value = data.appType;
    startPoll();
    startCountdown();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "初始化失败";
    status.value = "error";
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
};

const handleAppTypeChange = () => {
  if (visible.value) initQrcode();
};

const handleSuccess = () => {
  emit("success");
  handleClose();
};

const handleClose = () => {
  stopPoll();
  stopCountdown();
  uid.value = "";
  qrcodeImage.value = "";
  status.value = "pending";
  errorMessage.value = "";
  successMessage.value = "";
  countdown.value = 180;
};

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      initQrcode();
    } else {
      handleClose();
    }
  }
);

onUnmounted(() => {
  stopPoll();
  stopCountdown();
});
</script>

<style lang="scss" scoped>
.qrcode-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.qrcode-app-type {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;

  .app-type-label {
    flex: 0 0 auto;
    font-size: 13px;
    color: var(--theme-text-regular);
  }

  :deep(.el-select) {
    flex: 1;
  }
}

.option-desc {
  float: right;
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

.qrcode-app-hint {
  width: 100%;
  margin: 6px 0 14px;
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
  text-align: center;
}

.qrcode-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 60px 0;
  color: var(--theme-text-secondary);
  font-size: 14px;
}

.qrcode-wrapper {
  position: relative;
  width: 220px;
  height: 220px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.qrcode-img {
  width: 100%;
  height: 100%;
  display: block;
}

.qrcode-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #f56c6c;
  font-size: 14px;

  &.success {
    color: #67c23a;
  }
}

.qrcode-status {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: var(--theme-text-regular);
  min-height: 24px;

  .status-info {
    color: var(--theme-primary);
  }
  .status-success {
    color: #67c23a;
  }
  .status-error {
    color: #f56c6c;
  }
  .app-label {
    color: var(--theme-primary);
  }
}

.qrcode-actions {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.qrcode-timer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--theme-text-secondary);
}
</style>
