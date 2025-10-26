// Non-destructive saver: upserts named exports in data/index.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function UpsertDataExports(named_exports) {
  const data_dir = path.resolve(__dirname, "../data");
  const file_path = path.join(data_dir, "index.js");

  // read existing file (if any)
  let content = "";
  try {
    content = await fs.readFile(file_path, "utf8");
  } catch {
    // create a minimal file if it doesn't exist
    content = `// auto-generated data exports\n\n`;
  }

  // upsert each key independently
  for (const [key, value] of Object.entries(named_exports)) {
    const export_block = `export const ${key} = ${JSON.stringify(value, null, 2)};\n`;
    const regex = new RegExp(String.raw`export\s+const\s+${escapeRegex(key)}\s*=\s*[\s\S]*?;[ \t]*\n?`, "m");

    if (regex.test(content)) {
      // replace existing block
      content = content.replace(regex, export_block);
    } else {
      // append new block
      if (!content.endsWith("\n")) content += "\n";
      content += export_block + "\n";
    }
  }

  await fs.mkdir(data_dir, { recursive: true });
  await fs.writeFile(file_path, content, "utf8");
  console.log(`✅ Upserted exports in ${file_path}: ${Object.keys(named_exports).join(", ")}`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * Formats an array of place objects into a object where the keys are the place IDs.
 */
export function formatPlaces(place_array) {
  return place_array.reduce((acc, place) => {
    if (place && place.place_id) {
      acc[place.place_id] = {
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        formatted_address: place.formatted_address,
      };
    }
    return acc;
  }, {});
}

export function FilterDublinPlaces(
  places_data,
  { dublin_center = { lat: 53.3478, lng: -6.2597 }, max_distance_km = 12 } = {}
) {
  const to_radians = (deg) => (deg * Math.PI) / 180;
  const haversine = (a, b) => {
    const R = 6371; // km
    const d_lat = to_radians(b.lat - a.lat);
    const d_lng = to_radians(b.lng - a.lng);
    const lat1 = to_radians(a.lat);
    const lat2 = to_radians(b.lat);
    const h = Math.sin(d_lat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(d_lng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  // ensure we can iterate (object or array)
  const entries = Array.isArray(places_data) ? places_data.map((v, i) => [i, v]) : Object.entries(places_data);

  const filtered = {};

  for (const [place_id, info] of entries) {
    if (!info || !info.formatted_address) continue;
    const address = info.formatted_address.toLowerCase();
    const has_dublin = address.includes("dublin");
    const dist = haversine(dublin_center, { lat: info.lat, lng: info.lng });

    if (has_dublin || dist <= max_distance_km) {
      filtered[place_id] = info;
    }
  }

  return filtered;
}
