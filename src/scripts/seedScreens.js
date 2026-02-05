import { connectMongo } from "../db/mongo.js";
import { seedDefaultScreens } from "../services/screenSeed.js";

async function run() {
  await connectMongo();
  await seedDefaultScreens();
  console.log("Seeded default screens");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
