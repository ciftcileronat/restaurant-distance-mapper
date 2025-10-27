import axios from "axios";
import { orsGet, orsPost } from "./axios.js";

/**
 * Check the health status of the Open Route Service API
 * @return {Promise<void>}
 */
export async function getORSHealth() {
  try {
    const data = await orsGet("/health");
    console.log("✅ ORS Health Check:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ ORS Health Check failed.");
  }
}

export async function getORSStatus() {
  try {
    const data = await orsGet("/status");
    console.log("✅ ORS Status Check:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ ORS Status Check failed.");
    console.error(err);
  }
}

/**
 * Quick sanity test for ORS Matrix.
 * @param {"driving-car"|"cycling-regular"} profile
 */
export async function testMatrix(profile = "driving-car") {
  // ORS expects [lon, lat]
  const body = {
    locations: [
      [-6.2597, 53.3478], // O'Connell St (lng, lat)
      [-6.2551, 53.3422], // Grafton St
    ],
    metrics: ["distance"], // distance only
  };

  const endpoint = `/matrix/${profile}`;
  const data = await orsPost(endpoint, body);
  console.log(`✅ ${profile} matrix response:\n`, JSON.stringify(data, null, 2));
}
