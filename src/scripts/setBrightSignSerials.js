import { connectMongo } from "../db/mongo.js";
import Screen from "../models/Screen.js";

const updates = {
  WomensCosfrag: "D1E88S005227",
  MensCosfrag: "TFF27L004139",
};

async function run() {
  await connectMongo();
  for (const [name, serial] of Object.entries(updates)) {
    const res = await Screen.updateOne({ name }, { $set: { brightSignSerial: serial } });
    console.log(name, "->", serial, JSON.stringify(res));
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
