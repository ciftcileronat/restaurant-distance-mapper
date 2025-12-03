import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: "./.env" });

import {
  upsertDataExports,
  formatPlaces,
  buildLabelsAndLocations,
  computeDistanceMatrixORS,
  saveMatrixCsv,
  getRestaurantCoordinates,
} from "./helpers/general.js";
import { getRestaurantNames } from "./helpers/deliveroo.js";
import { resolvePlaces, getPlaceDetails } from "./services/google_services.js";
import { getORSHealth, getORSStatus, testMatrix } from "./services/open_route_services.js";

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
  const places_data = await resolvePlaces(response_restaurant_names);

  // Save the places data
  await upsertDataExports({ places_data_1: formatPlaces(places_data) });
}

async function getRestaurantDistancesMatrix() {
  const { dublin_places } = await import("./data/index.js");
  const { ids, labels, locations } = buildLabelsAndLocations(dublin_places);

  const distances = await computeDistanceMatrixORS(locations, { tile: 50, pauseMs: 300 });
  await saveMatrixCsv(ids, distances, "data/exports/matrix.csv"); // Excel-friendly

  console.log(`✅ Matrix built: ${labels.length}×${labels.length}`);
}

async function getPlaceRatingAndReviews() {
  const { dublin_places } = await import("./data/index.js");

  const place_ids = Object.keys(dublin_places);
  const details = await getPlaceDetails(place_ids);

  await upsertDataExports({ place_details: details });
}

import fs from "fs";
import { place_details } from "./data/index.js";

function export_place_details_to_csv(filepath = "data/exports/place_details.csv") {
  const header = "place_id,user_ratings_total,rating";
  const rows = place_details.map((p) => `${p.place_id},${p.user_ratings_total ?? ""},${p.rating ?? ""}`);

  const csv_content = [header, ...rows].join("\n");

  fs.writeFileSync(filepath, csv_content, "utf8");
  console.log(`✅ CSV exported to ${filepath}`);
}

export_place_details_to_csv();
