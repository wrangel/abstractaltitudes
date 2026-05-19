// src/backend/models/islandModel.mjs

import mongoose from "mongoose";
import { CONTRIBUTORS, MEDIA_PAGES, DRONE_MODELS } from "../constants.mjs";

const droneModelCodes = Object.keys(DRONE_MODELS);

/**
 * Island model schema for MongoDB
 *
 * Represents a drone photo or panorama location with related metadata,
 * including geographic coordinates, date/time, author info, and media type.
 *
 * @module models/islandModel
 */
const islandSchema = new mongoose.Schema({
  /**
   * Unique name identifier for the island photo or panorama.
   */
  name: {
    type: String,
    required: true,
    unique: true,
  },

  /**
   * Media page type, restricted to allowed media pages.
   */
  type: {
    required: true,
    type: String,
    enum: MEDIA_PAGES,
  },

  /**
   * Author or photographer of the media.
   */
  author: {
    type: String,
    required: true,
    enum: CONTRIBUTORS,
  },

  /**
   * Drone model used to capture the media.
   */
  drone: {
    type: String,
    required: true,
    enum: droneModelCodes,
  },

  /**
   * Date and time as a formatted string.
   * Used for human-readable display.
   */
  dateTimeString: {
    required: true,
    type: String,
  },

  /**
   * Date and time as a JavaScript Date object.
   * Used for sorting, querying, filtering.
   */
  dateTime: {
    required: true,
    type: Date,
  },

  /**
   * Geographic latitude of capture location.
   */
  latitude: {
    required: true,
    type: Number,
  },

  /**
   * Geographic longitude of capture location.
   */
  longitude: {
    required: true,
    type: Number,
  },

  /**
   * Altitude above sea level (meters).
   */
  altitude: {
    required: true,
    type: Number,
  },

  /**
   * Country name.
   */
  country: {
    required: true,
    type: String,
  },

  /**
   * Region, state, or province name.
   */
  region: {
    required: true,
    type: String,
  },

  /**
   * Location/city name.
   */
  location: {
    required: true,
    type: String,
  },

  /**
   * Postal or ZIP code (optional).
   */
  postalCode: {
    type: String,
  },

  /**
   * Road or street name (optional).
   */
  road: String,

  /**
   * Initial view parameters for Marzipano panorama.
   * Contains yaw, pitch, fov.
   */
  initialViewParameters: {
    yaw: { type: Number },
    pitch: { type: Number },
    fov: { type: Number },
  },

  /**
   * Levels configuration for Marzipano panorama.
   * Each level has tileSize, size, and fallbackOnly properties.
   */
  levels: [
    {
      tileSize: { type: Number, required: true },
      size: { type: Number, required: true },
      fallbackOnly: { type: Boolean, default: false },
    },
  ],
});

export const Island = mongoose.model("Island", islandSchema);
