import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const API_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const API_PLACE_DETAILS = (id) => `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`;

// Dublin settings
const DUBLIN_CENTROID = { lat: 53.3478, lng: -6.2597 };
const DUBLIN_RADIUS_M = 5000;
const REGION_CODE = "IE";
const INCLUDED_TYPE = "restaurant";

// ---------- MAIN FUNCTION ----------
/**
 * Resolve restaurant names into Google Places details (Dublin area).
 *
 * @param {string[]} names - array of restaurant names
 * @returns {Promise<Array<{ name: string, lat: number|null, lng: number|null, place_id: string|null, formatted_address: string|null }>>}
 */
export async function resolvePlaces(names) {
  if (!Array.isArray(names) || names.length === 0) throw new Error("Expected an array of restaurant names.");
  if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error("Google API key is required.");

  const api_key = process.env.GOOGLE_MAPS_API_KEY;
  const results = [];

  for (const name of names) {
    const trimmed_name = name.trim();
    console.log(`🔍 Searching for: ${trimmed_name}`);

    // 1️⃣ Text Search (bias to Dublin)
    const ts_body = {
      textQuery: trimmed_name,
      languageCode: "en",
      regionCode: REGION_CODE,
      includedType: INCLUDED_TYPE,
      locationBias: {
        circle: {
          center: {
            latitude: DUBLIN_CENTROID.lat,
            longitude: DUBLIN_CENTROID.lng,
          },
          radius: DUBLIN_RADIUS_M,
        },
      },
    };

    let candidate = null;

    try {
      const ts_res = await fetch(API_TEXT_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": api_key,
          "X-Goog-FieldMask": "places.id,places.formattedAddress,places.location",
        },
        body: JSON.stringify(ts_body),
      });

      if (!ts_res.ok) {
        console.log(ts_res);
        console.warn(`❌ Text Search failed for ${trimmed_name}: ${ts_res.status}`);
        results.push({ name: trimmed_name, lat: null, lng: null, place_id: null, formatted_address: null });
        continue;
      }

      const data = await ts_res.json();
      if (data.places && data.places.length > 0) {
        candidate = data.places[0];
      } else {
        console.warn(`⚠️ No candidate found for ${trimmed_name}`);
        results.push({ name: trimmed_name, lat: null, lng: null, place_id: null, formatted_address: null });
        continue;
      }
    } catch (err) {
      console.error(`❌ Text Search error for ${trimmed_name}:`, err.message);
      results.push({ name: trimmed_name, lat: null, lng: null, place_id: null, formatted_address: null });
      continue;
    }

    // 2️⃣ Place Details (to confirm coordinates & address)
    let details = null;
    try {
      const det_res = await fetch(API_PLACE_DETAILS(candidate.id), {
        headers: {
          "X-Goog-Api-Key": api_key,
          "X-Goog-FieldMask": "id,formattedAddress,location",
        },
      });

      if (det_res.ok) {
        details = await det_res.json();
      } else {
        console.warn(`⚠️ Place Details failed for ${trimmed_name}: ${det_res.status}`);
      }
    } catch (err) {
      console.warn(`⚠️ Place Details error for ${trimmed_name}:`, err.message);
    }

    const lat = details?.location?.latitude ?? candidate?.location?.latitude ?? null;
    const lng = details?.location?.longitude ?? candidate?.location?.longitude ?? null;
    const formatted_address = details?.formattedAddress ?? candidate?.formattedAddress ?? null;
    const place_id = details?.id ?? candidate?.id ?? null;

    results.push({
      name: trimmed_name,
      lat,
      lng,
      place_id,
      formatted_address,
    });

    // optional short delay to stay within quotas
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`✅ Resolved ${results.length} places.`);
  return results;
}
