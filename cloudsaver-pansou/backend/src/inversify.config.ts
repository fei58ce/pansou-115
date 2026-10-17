import { Container } from "inversify";
import { TYPES } from "./core/types";

// Services
import { DatabaseService } from "./services/DatabaseService";
import { Cloud115Service } from "./services/Cloud115Service";
import { QuarkService } from "./services/QuarkService";
import { Searcher } from "./services/Searcher";
import { PansouSearcher } from "./services/PansouSearcher";
import { OneStrmService } from "./services/OneStrmService";
import { DoubanService } from "./services/DoubanService";
import { TmdbService } from "./services/TmdbService";
import { Cloud115QrcodeService } from "./services/Cloud115QrcodeService";
import { Cloud115LixianService } from "./services/Cloud115LixianService";
import { UserService } from "./services/UserService";
import { ImageService } from "./services/ImageService";
import { SettingService } from "./services/SettingService";
import { SponsorsService } from "./services/SponsorsService";
// Controllers
import { Cloud115Controller } from "./controllers/cloud115";
import { QuarkController } from "./controllers/quark";
import { ResourceController } from "./controllers/resource";
import { DoubanController } from "./controllers/douban";
import { TmdbController } from "./controllers/tmdb";
import { Cloud115QrcodeController } from "./controllers/cloud115Qrcode";
import { ImageController } from "./controllers/teleImages";
import { SettingController } from "./controllers/setting";
import { UserController } from "./controllers/user";
import { SponsorsController } from "./controllers/sponsors";
const container = new Container();

// Services
container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseService).inSingletonScope();
container.bind<Cloud115Service>(TYPES.Cloud115Service).to(Cloud115Service).inSingletonScope();
container.bind<QuarkService>(TYPES.QuarkService).to(QuarkService).inSingletonScope();
container.bind<Searcher>(TYPES.Searcher).to(Searcher).inSingletonScope();
container.bind<PansouSearcher>(TYPES.PansouSearcher).to(PansouSearcher).inSingletonScope();
container.bind<OneStrmService>(TYPES.OneStrmService).to(OneStrmService).inSingletonScope();
container.bind<ImageService>(TYPES.ImageService).to(ImageService).inSingletonScope();
container.bind<SettingService>(TYPES.SettingService).to(SettingService).inSingletonScope();
container.bind<DoubanService>(TYPES.DoubanService).to(DoubanService).inSingletonScope();
container.bind<TmdbService>(TYPES.TmdbService).to(TmdbService).inSingletonScope();
container
  .bind<Cloud115QrcodeService>(TYPES.Cloud115QrcodeService)
  .to(Cloud115QrcodeService)
  .inSingletonScope();
container
  .bind<Cloud115LixianService>(TYPES.Cloud115LixianService)
  .to(Cloud115LixianService)
  .inSingletonScope();
container.bind<UserService>(TYPES.UserService).to(UserService).inSingletonScope();
container.bind<SponsorsService>(TYPES.SponsorsService).to(SponsorsService).inSingletonScope();
// Controllers
container.bind<Cloud115Controller>(TYPES.Cloud115Controller).to(Cloud115Controller);
container.bind<QuarkController>(TYPES.QuarkController).to(QuarkController);
container.bind<ResourceController>(TYPES.ResourceController).to(ResourceController);
container.bind<DoubanController>(TYPES.DoubanController).to(DoubanController);
container.bind<TmdbController>(TYPES.TmdbController).to(TmdbController);
container
  .bind<Cloud115QrcodeController>(TYPES.Cloud115QrcodeController)
  .to(Cloud115QrcodeController);
container.bind<ImageController>(TYPES.ImageController).to(ImageController);
container.bind<SettingController>(TYPES.SettingController).to(SettingController);
container.bind<UserController>(TYPES.UserController).to(UserController);
container.bind<SponsorsController>(TYPES.SponsorsController).to(SponsorsController);

export { container };
