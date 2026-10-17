<template>
  <div class="setting">
    <!-- 全局设置 -->
    <div v-if="settingStore.globalSetting" class="setting__section">
      <div class="setting__title">项目配置</div>
      <div class="setting__card">
        <van-cell-group inset>
          <van-field
            v-model="localGlobalSetting.httpProxyHost"
            label="代理服务器IP"
            placeholder="127.0.0.1"
            @update:model-value="handleProxyHostChange"
          />
          <van-field
            v-model="localGlobalSetting.httpProxyPort"
            label="代理端口"
            placeholder="7890"
          />
          <van-field
            v-model.number="localGlobalSetting.AdminUserCode"
            label="管理员码"
            type="digit"
            placeholder="设置管理员注册码"
          />
          <van-field
            v-model.number="localGlobalSetting.CommonUserCode"
            label="用户注册码"
            type="digit"
            placeholder="设置普通用户注册码"
          />
          <van-cell center title="启用代理">
            <template #right-icon>
              <van-switch
                v-model="localGlobalSetting.isProxyEnabled"
                size="24px"
                @change="handleProxyChange"
              />
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </div>

    <!-- OneStrm 设置 -->
    <div class="setting__section" v-if="settingStore.globalSetting">
      <div class="setting__title">OneStrm 联动</div>
      <div class="setting__card">
        <van-cell-group inset>
          <van-field v-model="localGlobalSetting.oneStrmBaseUrl" label="OneStrm地址" placeholder="http://8.133.190.156:58003" />
          <van-field v-model="localGlobalSetting.oneStrmWebhookToken" type="password" label="Webhook Token" placeholder="Webhook_token" />
          <van-field v-model="localGlobalSetting.oneStrmScanPath" label="扫描路径" placeholder="/emby" />
          <van-cell center title="转存后允许触发 OneStrm">
            <template #right-icon><van-switch v-model="localGlobalSetting.oneStrmAutoTrigger" size="24px" /></template>
          </van-cell>
        </van-cell-group>
      </div>
    </div>

    <!-- 用户设置 -->
    <div class="setting__section">
      <div class="setting__title">用户配置</div>
      <div class="setting__card">
        <van-cell-group inset>
          <van-field
            v-model="localUserSettings.cloud115Cookie"
            :type="showCloud115Cookie ? 'text' : 'password'"
            label="115网盘"
            rows="2"
            autosize
            placeholder="扫码登录或手动填写Cookie"
          >
            <template #right-icon>
              <van-icon
                :name="showCloud115Cookie ? 'eye-o' : 'closed-eye'"
                @click="showCloud115Cookie = !showCloud115Cookie"
              />
            </template>
          </van-field>
          <van-field
            v-model="localGlobalSetting.tmdbApiKey"
            label="TMDB Key"
            placeholder="TMDB API 密钥，保存后生效"
          />
          <van-cell title="115扫码登录" is-link @click="qrcodeDialog = true">
          <van-cell title="检测115授权" is-link @click="check115Auth" />
            <template #icon>
              <van-icon name="qr" style="margin-right: 8px" />
            </template>
          </van-cell>

          <van-field
            v-model="localUserSettings.quarkCookie"
            :type="showQuarkCookie ? 'text' : 'password'"
            label="夸克网盘"
            rows="2"
            autosize
            placeholder="请输入夸克网盘Cookie"
          >
            <template #right-icon>
              <van-icon
                :name="showQuarkCookie ? 'eye-o' : 'closed-eye'"
                @click="showQuarkCookie = !showQuarkCookie"
              />
            </template>
          </van-field>
        </van-cell-group>
      </div>
    </div>

    <!-- 115 扫码登录弹窗 -->
    <Cloud115QrcodeLogin v-model="qrcodeDialog" @success="onQrcodeSuccess" />

    <!-- 保存按钮 -->
    <div class="setting__submit">
      <van-button round block type="primary" @click="handleSave"> 保存设置 </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserSettingStore } from "@/stores/userSetting";
import { ref, watch } from "vue";
import { showNotify } from "vant";
import type { GlobalSettingAttributes, UserSettingAttributes } from "@/types/user";
import Cloud115QrcodeLogin from "@/components/Cloud115QrcodeLogin.vue";
import { cloud115QrcodeApi } from "@/api/cloud115Qrcode";

const settingStore = useUserSettingStore();
const qrcodeDialog = ref(false);

const localGlobalSetting = ref<GlobalSettingAttributes>({
  httpProxyHost: "127.0.0.1",
  httpProxyPort: "7890",
  isProxyEnabled: false,
  AdminUserCode: 230713,
  CommonUserCode: 9527,
  tmdbApiKey: "",
  oneStrmBaseUrl: "",
  oneStrmWebhookToken: "",
  oneStrmScanPath: "/emby",
  oneStrmAutoTrigger: false,
});

const localUserSettings = ref<UserSettingAttributes>({
  cloud115Cookie: "",
  quarkCookie: "",
});

const showCloud115Cookie = ref(false);
const showQuarkCookie = ref(false);

// 监听 store 变化
watch(
  () => settingStore.globalSetting,
  (newVal) => {
    if (newVal) {
      localGlobalSetting.value = { ...newVal };
    }
  },
  { immediate: true }
);

watch(
  () => settingStore.userSettings,
  (newVal) => {
    if (newVal) {
      localUserSettings.value = { ...newVal };
    }
  },
  { immediate: true }
);

// 初始化获取设置
settingStore.getSettings();

// 处理代理开关变化并立即保存
const handleProxyChange = async (val: boolean) => {
  try {
    localGlobalSetting.value.isProxyEnabled = val;
    await settingStore.saveSettings({
      globalSetting: localGlobalSetting.value,
      userSettings: localUserSettings.value,
    });
    showNotify({ type: "success", message: "代理设置已更新" });
  } catch (error) {
    showNotify({ type: "danger", message: "代理设置更新失败" });
    // 保存失败时恢复开关状态
    localGlobalSetting.value.isProxyEnabled = !val;
  }
};

// 其他设置的保存
const handleSave = async () => {
  try {
    await settingStore.saveSettings({
      globalSetting: localGlobalSetting.value,
      userSettings: localUserSettings.value,
    });
    showNotify({ type: "success", message: "设置保存成功" });
  } catch (error) {
    showNotify({ type: "danger", message: "设置保存失败" });
  }
};

// 处理代理地址,去除协议前缀
const handleProxyHostChange = (val: string) => {
  const cleanHost = val.replace(/^(https?:\/\/)/i, "");
  localGlobalSetting.value.httpProxyHost = cleanHost;
};

const check115Auth = async () => {
  try {
    const result = await cloud115QrcodeApi.checkAuth();
    showNotify({ type: result.valid ? "success" : "warning", message: result.message });
  } catch (error) {
    showNotify({ type: "danger", message: error instanceof Error ? error.message : "检测 115 授权失败" });
  }
};

const onQrcodeSuccess = async () => {
  await settingStore.getSettings();
  showNotify({ type: "success", message: "115 扫码登录成功，cookie 已更新" });
};
</script>

<style lang="scss" scoped>
.setting {
  min-height: 100vh;
  background: var(--theme-background);
  padding: var(--spacing-base);
  padding-bottom: 90px; // 为底部导航栏和按钮留出空间

  &__section {
    margin-bottom: var(--spacing-lg);
  }

  &__title {
    font-size: 16px; // 统一字体大小
    font-weight: 500;
    margin-bottom: var(--spacing-base);
    color: var(--theme-color);
  }

  &__card {
    background: var(--theme-other_background);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
  }

  &__help {
    margin-top: var(--spacing-base);

    .help__title {
      font-size: 14px; // 统一字体大小
      margin-bottom: var(--spacing-sm);
      color: var(--theme-color);
    }
  }

  &__submit {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 50px; // tabbar 高度
    padding: var(--spacing-base);
    background: var(--theme-other_background);
    z-index: 99;
  }
}

// 深度修改 Vant 组件样式
:deep(.van-field) {
  font-size: 14px; // 统一字体大小
}

:deep(.van-field__label) {
  width: 6em;
  color: var(--theme-color);
}

:deep(.van-cell) {
  font-size: 14px; // 统一字体大小
  padding: 12px var(--spacing-base);
}

:deep(.van-button) {
  height: 40px; // 统一按钮高度
  font-size: 14px; // 统一字体大小
}

:deep(.van-cell-group--inset) {
  margin: 0;
}

// 添加图标样式
:deep(.van-field__right-icon) {
  padding: 0 8px;
  cursor: pointer;
  color: var(--theme-color);

  .van-icon {
    font-size: 18px;
  }
}
</style>
