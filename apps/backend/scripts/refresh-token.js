/**
 * Script to refresh Threads access token
 * Run this when your access token expires
 */

import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";
import { log } from "../src/config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env") });

async function refreshAccessToken() {
  const clientSecret = process.env.THREADS_CLIENT_SECRET;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const refreshToken = process.env.THREADS_REFRESH_TOKEN;

  if (!clientSecret) {
    log.error("THREADS_CLIENT_SECRET not found in .env file");
    process.exit(1);
  }

  if (!accessToken && !refreshToken) {
    log.error(
      "Neither THREADS_ACCESS_TOKEN nor THREADS_REFRESH_TOKEN found in .env file"
    );
    process.exit(1);
  }

  try {
    log.info("Attempting to refresh access token...");
    log.info("Using refresh token:", refreshToken ? "Yes" : "No");
    log.info("Using access token:", accessToken ? "Yes" : "No");

    // Try to exchange for long-lived token first
    const response = await axios.post(
      "https://graph.threads.net/access_token",
      {
        grant_type: "th_exchange_token",
        client_secret: clientSecret,
        access_token: refreshToken || accessToken,
      }
    );

    log.success("Token refreshed successfully!");
    log.info("New token details:");
    log.info("Access Token:", response.data.access_token);
    log.info("Token Type:", response.data.token_type);
    log.info("Expires In:", response.data.expires_in, "seconds");

    if (response.data.expires_in) {
      const expirationDate = new Date(
        Date.now() + response.data.expires_in * 1000
      );
      log.info("Expires At:", expirationDate.toLocaleString());
    }

    log.info("Update your .env file with:");
    log.info("THREADS_ACCESS_TOKEN=" + response.data.access_token);

    if (response.data.refresh_token) {
      log.info("THREADS_REFRESH_TOKEN=" + response.data.refresh_token);
    }
  } catch (error) {
    log.error("Failed to refresh token");

    if (error.response?.data) {
      log.error("Error details:", JSON.stringify(error.response.data, null, 2));

      if (error.response.data.error) {
        const apiError = error.response.data.error;
        log.error(
          "Error message:",
          apiError.message || apiError.error_user_msg
        );

        if (
          apiError.code === 190 ||
          (apiError.message && apiError.message.includes("expired"))
        ) {
          log.error("Your token has expired and cannot be refreshed.");
          log.error("You need to get a new token by:");
          log.error("1. Go to https://developers.facebook.com/apps/");
          log.error("2. Select your app");
          log.error("3. Go to Threads API settings");
          log.error("4. Generate a new long-lived access token");
          log.error("5. Update your .env file with the new token");
        }
      }
    } else {
      log.error("Error:", error.message);
    }

    process.exit(1);
  }
}

refreshAccessToken();
