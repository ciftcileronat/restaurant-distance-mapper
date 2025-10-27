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
      [-6.262995, 53.3431247], // Sprout & Co – Exchequer Street
      [-6.2651653, 53.3453254], // Tula Temple Bar
    ],
    metrics: ["distance"], // distance only
  };

  const endpoint = `/matrix/${profile}`;
  const data = await orsPost(endpoint, body);
  console.log(`✅ ${profile} matrix response:\n`, JSON.stringify(data, null, 2));
}
