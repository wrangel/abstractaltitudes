// src/backend/utils/mongodbConnection.mjs

import mongoose from "mongoose";
import logger from "../utils/logger.mjs";

/**
 * Establishes a connection to MongoDB using Mongoose.
 * Uses serverSelectionTimeoutMS for connection timeout control.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.MONGODB_DB_USER}:${process.env.MONGODB_DB_PASSWORD}@${process.env.MONGODB_SERVER}/${process.env.MONGODB_DB}?retryWrites=true&w=majority`,
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

/**
 * Gracefully closes the MongoDB connection.
 */
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (err) {
    logger.error("Failed to close MongoDB connection:", err);
  }
};

export { connectDB, closeDB };
