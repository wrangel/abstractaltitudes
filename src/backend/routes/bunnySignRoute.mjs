// src/backend/routes/bunnySignRoute.mjs

import express from "express";
import { signedUrl } from "../urlHandler.mjs";

const router = express.Router();

router.use(express.json()); // parse JSON bodies

router.post("/sign-url", async (req, res) => {
  try {
    const { path, width, height } = req.body;

    if (!path) {
      return res.status(400).json({ error: "Missing 'path' in request body" });
    }

    const signed = await signedUrl(path, { width, height });

    res.json({ signedUrl: signed });
  } catch (error) {
    console.error("Failed to generate signed URL:", error);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

export default router;
