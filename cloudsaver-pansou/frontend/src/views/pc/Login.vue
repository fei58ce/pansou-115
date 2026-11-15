<template>
  <div class="login-page">
    <img :src="sceneLoginLeft" alt="" class="login-scene login-scene--left moe-animate--float" />
    <img :src="sceneLoginRight" alt="" class="login-scene login-scene--right moe-animate--float" />
    <div class="login-card">
      <div class="card-header">
        <img :src="mascotLogo" alt="Logo" class="logo moe-animate--breathe" />
        <h1 class="title">{{ PROJECT_NAME }}</h1>
        <p class="subtitle">登录后即可搜索资源、追更和转存</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <el-input v-model="loginForm.username" placeholder="用户名" autocomplete="username">
                <template #prefix><img :src="iconUser" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                show-password
                autocomplete="current-password"
              >
                <template #prefix><img :src="iconLock" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="rememberPassword">记住密码</el-checkbox>
            </div>

            <el-button type="primary" class="submit-btn" :loading="loading" @click="handleLogin">
              登录
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules">
            <el-form-item prop="username">
              <el-input v-model="registerForm.username" placeholder="用户名">
                <template #prefix><img :src="iconUser" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="密码"
                show-password
              >
                <template #prefix><img :src="iconLock" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <el-form-item prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="确认密码"
                show-password
              >
                <template #prefix><img :src="iconLock" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <el-form-item prop="registerCode">
              <el-input v-model="registerForm.registerCode" placeholder="注册码">
                <template #prefix><img :src="iconKey" alt="" class="input-icon" /></template>
              </el-input>
            </el-form-item>

            <el-button type="primary" class="submit-btn" :loading="loading" @click="handleRegister">
              注册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import mascotLogo from "@/assets/moe/mascot-logo.webp";
import sceneLoginLeft from "@/assets/moe/scene-login-left.webp";
import sceneLoginRight from "@/assets/moe/scene-login-right.webp";
import iconUser from "@/assets/moe/icon-user.webp";
import iconLock from "@/assets/moe/icon-lock.webp";
import iconKey from "@/assets/moe/icon-key.webp";
import { userApi } from "@/api/user";
import { PROJECT_NAME } from "@/constants/project";
import { STORAGE_KEYS } from "@/constants/storage";
import type { FormItemRule } from "element-plus";

// 状态
const activeTab = ref("login");
const loading = ref(false);
const rememberPassword = ref(false);

const loginForm = ref({
  username: "",
  password: "",
});

const registerForm = ref({
  username: "",
  password: "",
  confirmPassword: "",
  registerCode: "",
});

// 表单校验规则
const loginRules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 3, max: 20, message: "长度在 3 到 20 个字符", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 20, message: "长度在 6 到 20 个字符", trigger: "blur" },
  ],
};

const registerRules = {
  ...loginRules,
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    {
      validator: (_rule: FormItemRule, value: string, callback: (error?: Error) => void) => {
        if (value !== registerForm.value.password) {
          callback(new Error("两次输入密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  registerCode: [{ required: true, message: "请输入注册码", trigger: "blur" }],
};

const router = useRouter();
const loginFormRef = ref();
const registerFormRef = ref();

// 记住密码相关
onMounted(() => {
  const savedUsername = localStorage.getItem(STORAGE_KEYS.USERNAME);
  const savedPassword = localStorage.getItem(STORAGE_KEYS.PASSWORD);
  if (savedUsername && savedPassword) {
    loginForm.value.username = savedUsername;
    loginForm.value.password = savedPassword;
    rememberPassword.value = true;
  }
});

// 登录处理
const handleLogin = async () => {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      try {
        const res = await userApi.login(loginForm.value);
        if (res.code === 0) {
          // 记住密码
          if (rememberPassword.value) {
            localStorage.setItem(STORAGE_KEYS.USERNAME, loginForm.value.username);
            localStorage.setItem(STORAGE_KEYS.PASSWORD, loginForm.value.password);
          } else {
            localStorage.removeItem(STORAGE_KEYS.USERNAME);
            localStorage.removeItem(STORAGE_KEYS.PASSWORD);
          }

          localStorage.setItem(STORAGE_KEYS.TOKEN, res.data.token);
          ElMessage.success("登录成功");
          router.push("/");
        } else {
          ElMessage.error(res.message || "登录失败");
        }
      } catch (error: unknown) {
        ElMessage.error(error instanceof Error ? error.message : "登录失败");
      } finally {
        loading.value = false;
      }
    }
  });
};

// 注册处理
const handleRegister = async () => {
  if (!registerFormRef.value) return;

  await registerFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      loading.value = true;
      try {
        const res = await userApi.register({
          username: registerForm.value.username,
          password: registerForm.value.password,
          registerCode: registerForm.value.registerCode,
        });

        if (res.code === 0) {
          ElMessage.success("注册成功");
          // 自动填充登录表单
          loginForm.value.username = registerForm.value.username;
          loginForm.value.password = registerForm.value.password;
          activeTab.value = "login";
          // 自动登录
          handleLogin();
        } else {
          ElMessage.error(res.message || "注册失败");
        }
      } catch (error: unknown) {
        ElMessage.error(error instanceof Error ? error.message : "注册失败");
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped lang="scss">
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32px 16px;
  overflow-y: auto;
  background:
    radial-gradient(circle at 14% 22%, var(--pink-100), transparent 42%),
    radial-gradient(circle at 86% 80%, var(--primary-100), transparent 42%), var(--surface);
}

.login-scene {
  position: absolute;
  top: 50%;
  pointer-events: none;
  user-select: none;

  &--left {
    left: 4%;
    width: min(23vw, 360px);
    transform: translateY(-42%);
  }

  &--right {
    right: 5%;
    width: min(20vw, 310px);
    transform: translateY(-50%);
  }
}

// 窄窗口里插画会压到登录卡片
@media (max-width: 1000px) {
  .login-scene {
    display: none;
  }
}

@media (max-height: 760px) {
  .login-page {
    align-items: flex-start;
  }
}

.login-card {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 420px;
  max-width: 100%;
  padding: 36px 36px 32px;
  background: var(--surface-raised);
  border: var(--line-width) solid var(--line);
  border-radius: var(--radius-sketch);
  box-shadow: var(--shadow-3);
}

.card-header {
  margin-bottom: 20px;
  text-align: center;

  .logo {
    width: 76px;
    height: 76px;
    margin-bottom: 8px;
    object-fit: contain;
  }

  .title {
    margin: 0 0 6px;
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
}

.login-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--border);
  }

  :deep(.el-tabs__item) {
    height: 44px;
    font-size: var(--text-md);
    color: var(--text-secondary);

    &.is-active {
      color: var(--primary-600);
      font-weight: var(--weight-medium);
    }
  }

  :deep(.el-tabs__active-bar) {
    background-color: var(--primary-600);
  }
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-input) {
  --el-input-height: 44px;
  font-size: var(--text-base);
}

.input-icon {
  width: 18px;
  height: 18px;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 20px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  border-radius: var(--radius-sketch-pill);
}
</style>
