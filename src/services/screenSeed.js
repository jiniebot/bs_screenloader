import Screen from "../models/Screen.js";
import config from "../config/index.js";

export async function seedDefaultScreens() {
  const screens = [
    {
      name: "macys_cos_womens",
      companyName: "macys_cos",
      owner: "admin",
      templateDir: "source womens proj",
      destinationFolder: "macys_cos_womens",
      baseUrl: config.screenDefaults.womensBaseUrl,
      prerequisite: { width: 1280, height: 1024 },
      transform: {
        offsetX: 20,
        offsetY: 52,
        scale: 1,
        rotation: 0,
        canvasWidth: 1920,
        canvasHeight: 1080,
      },
    },
    {
      name: "macys_cos_mens",
      companyName: "macys_cos",
      owner: "admin",
      templateDir: "source mens proj",
      destinationFolder: "macys_cos_mens",
      baseUrl: config.screenDefaults.mensBaseUrl,
      prerequisite: { width: 1080, height: 1920 },
      transform: {
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: -90,
        canvasWidth: 1920,
        canvasHeight: 1080,
      },
    },
  ];

  for (const screen of screens) {
    await Screen.updateOne({ name: screen.name }, { $set: screen }, { upsert: true });
  }
}
