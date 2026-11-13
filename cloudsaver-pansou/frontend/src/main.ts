import { createApp } from "vue";
import { createPinia } from "pinia";
import { isMobileDevice } from "@/utils/index";
import App from "./App.vue";
import { Lazyload } from "vant";
import "vant/es/notify/style";
import "vant/es/dialog/style";
import "vant/es/toast/style";
// Element Plus 按需引入：模板里的组件样式由 unplugin 自动带上，脚本里直接调用的提示框要自己引样式
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "@/styles/responsive.scss";
import "@/styles/common.scss";
import "@/styles/tokens.scss";
import "@/styles/theme.scss";

import router from "./router/index";

const app = createApp(App);

app.use(createPinia());
app.use(Lazyload);
app.use(router);

app.mount("#app");

const setRootFontSize = () => {
  const isMobile = isMobileDevice();
  if (!isMobile) {
    return;
  } // PC端不干预
  const clientWidth = document.documentElement.clientWidth;
  const baseSize = clientWidth / 7.5; // 按750px设计稿
  document.documentElement.style.fontSize = baseSize + "px";
};

// 初始化执行
setRootFontSize();
// 监听窗口变化
window.addEventListener("resize", setRootFontSize);
