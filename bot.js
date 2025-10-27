import { upsertDataExports, formatPlaces, filterDublinPlaces } from "./helpers/general.js";
import { getRestaurantNames } from "./helpers/deliveroo.js";
import { resolvePlaces } from "./helpers/google_services.js";
import { healthORS } from "./helpers/open_route_services.js";

import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: "./.env" });

/**
 * Run the Playwright bot to scrape restaurant names and save them.
 */
async function runBot() {
  const DELIVEROO_BASE_URL = process.env.DELIVEROO_BASE_URL;
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(DELIVEROO_BASE_URL, {
    waitUntil: "domcontentloaded",
  });

  const response_restaurant_names = await getRestaurantNames(page);
  await upsertDataExports({ response_restaurant_names });

  await context.close();
  await browser.close();
}

async function getRestaurantPlaces() {
  const { response_restaurant_names } = await import("./data/index.js");
  const places_data = await resolvePlaces(response_restaurant_names, process.env.GOOGLE_MAPS_API_KEY);

  // Save the places data
  await upsertDataExports({ places_data_1: formatPlaces(places_data) });
}
