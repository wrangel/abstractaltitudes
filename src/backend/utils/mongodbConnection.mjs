// src/backend/utils/mongodbConnection.mjs

import mongoose from "mongoose";
import logger from "../utils/logger.mjs";

const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb://${process.env.MONGODB_DB_USER}:${encodeURIComponent(
        process.env.MONGODB_DB_PASSWORD
      )}@${process.env.MONGODB_SERVER}/${
        process.env.MONGODB_DB
      }?tls=true&authSource=admin&retryWrites=true&w=majority`,
      {
        serverSelectionTimeoutMS: 10000,
      }
    );
    logger.info("Successfully connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    throw err;
  }
};

const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (err) {
    logger.error("Failed to close MongoDB connection:", err);
  }
};

export { connectDB, closeDB };
