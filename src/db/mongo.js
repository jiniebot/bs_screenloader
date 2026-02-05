import mongoose from "mongoose";
import config from "../config/index.js";

export async function connectMongo() {
  if (!config.mongodbUri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}
