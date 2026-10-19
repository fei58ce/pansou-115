import { Router } from "express";
import { container } from "../inversify.config";
import { TYPES } from "../core/types";
import { Cloud115Controller } from "../controllers/cloud115";
import { QuarkController } from "../controllers/quark";
import { ResourceController } from "../controllers/resource";
import { DoubanController } from "../controllers/douban";
import { TmdbController } from "../controllers/tmdb";
import { ImageController } from "../controllers/teleImages";
import { SettingController } from "../controllers/setting";
import { UserController } from "../controllers/user";
import { SponsorsController } from "../controllers/sponsors";
import { Cloud115QrcodeController } from "../controllers/cloud115Qrcode";
import { OneStrmController } from "../controllers/onestrm";

const router = Router();

// 获取控制器实例
const cloud115Controller = container.get<Cloud115Controller>(TYPES.Cloud115Controller);
const quarkController = container.get<QuarkController>(TYPES.QuarkController);
const resourceController = container.get<ResourceController>(TYPES.ResourceController);
const doubanController = container.get<DoubanController>(TYPES.DoubanController);
const tmdbController = container.get<TmdbController>(TYPES.TmdbController);
const imageController = container.get<ImageController>(TYPES.ImageController);
const settingController = container.get<SettingController>(TYPES.SettingController);
const userController = container.get<UserController>(TYPES.UserController);
const sponsorsController = container.get<SponsorsController>(TYPES.SponsorsController);
const cloud115QrcodeController = container.get<Cloud115QrcodeController>(
  TYPES.Cloud115QrcodeController
);
const oneStrmController = container.get<OneStrmController>(TYPES.OneStrmController);

// 用户相关路由
router.post("/user/login", (req, res) => userController.login(req, res));
router.post("/user/register", (req, res) => userController.register(req, res));

// 图片相关路由
router.get("/tele-images", (req, res) => imageController.getImages(req, res));

// 设置相关路由
router.get("/setting/get", (req, res) => settingController.get(req, res));
router.post("/setting/save", (req, res) => settingController.save(req, res));

// 资源搜索
router.get("/search", (req, res) => resourceController.search(req, res));

// 获取赞助者列表
router.get("/sponsors", (req, res) => sponsorsController.get(req, res));

// 115网盘相关
router.get("/cloud115/share-info", (req, res) => cloud115Controller.getShareInfo(req, res));
router.get("/cloud115/folders", (req, res) => cloud115Controller.getFolderList(req, res));
router.post("/cloud115/save", (req, res) => cloud115Controller.saveFile(req, res));
router.get("/cloud115/auth/status", (req, res) => cloud115Controller.checkAuth(req, res));
// 115 二维码扫码登录
router.post("/cloud115/qrcode/init", (req, res) => cloud115QrcodeController.init(req, res));
router.get("/cloud115/qrcode/check", (req, res) => cloud115QrcodeController.check(req, res));
router.get("/cloud115/qrcode/qr-image", (req, res) =>
  cloud115QrcodeController.getQrImage(req, res)
);
// 115 离线下载（磁力/链接）
router.post("/cloud115/lixian/add", (req, res) => cloud115QrcodeController.addLixianTask(req, res));
router.get("/cloud115/lixian/tasks", (req, res) =>
  cloud115QrcodeController.getLixianTasks(req, res)
);
router.get("/cloud115/lixian/history", (req, res) =>
  cloud115QrcodeController.getLixianHistory(req, res)
);
router.post("/cloud115/lixian/retry", (req, res) =>
  cloud115QrcodeController.retryLixianTask(req, res)
);
router.post("/cloud115/lixian/rename", (req, res) =>
  cloud115QrcodeController.renameLixianTask(req, res)
);

// OneStrm 状态
router.get("/onestrm/status", (req, res) => oneStrmController.getStatus(req, res));

// 夸克网盘相关
router.get("/quark/share-info", (req, res) => quarkController.getShareInfo(req, res));
router.get("/quark/folders", (req, res) => quarkController.getFolderList(req, res));
router.post("/quark/save", (req, res) => quarkController.saveFile(req, res));

// 获取豆瓣热门列表
router.get("/douban/hot", (req, res) => doubanController.getDoubanHotList(req, res));

// TMDB 榜单
router.get("/tmdb/trending", (req, res) => tmdbController.getTrending(req, res));
router.get("/tmdb/popular", (req, res) => tmdbController.getPopular(req, res));
router.get("/tmdb/top-rated", (req, res) => tmdbController.getTopRated(req, res));
router.get("/tmdb/now-playing", (req, res) => tmdbController.getNowPlaying(req, res));
router.get("/tmdb/genres", (req, res) => tmdbController.getGenres(req, res));

export default router;
