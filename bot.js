import { UpsertDataExports, formatPlaces, FilterDublinPlaces } from "./helpers/general.js";
import { GetRestaurantNames } from "./helpers/deliveroo.js";
import { ResolvePlaces } from "./helpers/google_services.js";

import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: "./.env" });

/**
 * Run the Playwright bot to scrape restaurant names and save them.
 */
async function RunBot() {
  const DELIVEROO_BASE_URL = process.env.DELIVEROO_BASE_URL;
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(DELIVEROO_BASE_URL, {
    waitUntil: "domcontentloaded",
  });

  const response_restaurant_names = await GetRestaurantNames(page);
  await UpsertDataExports({ response_restaurant_names });

  await context.close();
  await browser.close();
}

async function getRestaurantPlaces() {
  const { response_restaurant_names } = await import("./data/index.js");

  /*
  // during testing, limit to two names
  const limited_names = response_restaurant_names;
  */

  const places_data = await ResolvePlaces(limited_names, process.env.GOOGLE_MAPS_API_KEY);

  // Save the places data
  await UpsertDataExports({ places_data_1: formatPlaces(places_data) });
}
