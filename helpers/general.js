// Non-destructive saver: upserts named exports in data/index.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { orsPost } from "../services/axios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function upsertDataExports(named_exports) {
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

export function filterDublinPlaces(
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

/**
 * Builds an order object from the given places for ORS matrix requests.
 * @param {Object} places - Object where keys are place IDs and values contain lat/lng info.
 * @return {Object} - Object containing ids, labels, and locations arrays.
 */
export function buildLabelsAndLocations(places) {
  const entries = Object.entries(places); // [[place_id, info], ...]
  const ids = entries.map(([k, _]) => k);
  const labels = entries.map(([_, v]) => v.name);
  const locations = entries.map(([_, v]) => [v.lng, v.lat]); // ORS expects [lon, lat]
  return { ids, labels, locations };
}

/**
 * Compute full NxN distance matrix (meters) using ORS Matrix, tiled.
 * @param {number[][]} locations - array of [lon,lat]
 * @param {object} opts
 * @param {number} [opts.tile=50] - tile size (origins x destinations)
 * @param {number} [opts.pauseMs=300] - pause between tile requests
 * @returns {Promise<number[][]>} distances (meters), NxN
 */
export async function computeDistanceMatrixORS(locations, { tile = 50, pauseMs = 300 } = {}) {
  const N = locations.length;
  const distances = Array.from({ length: N }, () => Array(N).fill(null));

  // Pre-send full locations once per tile request (ORS allows full list + source/dest index slices)
  // We'll reuse the same "locations" array and pass sources/destinations each time.
  const makeBody = (sources, destinations) => ({
    locations,
    sources,
    destinations,
    metrics: ["distance"],
  });

  const blocks = Math.ceil(N / tile);
  for (let r = 0; r < blocks; r++) {
    const rowStart = r * tile;
    const rowEnd = Math.min(rowStart + tile, N) - 1;
    const sources = range(rowStart, rowEnd);

    for (let c = 0; c < blocks; c++) {
      const colStart = c * tile;
      const colEnd = Math.min(colStart + tile, N) - 1;
      const destinations = range(colStart, colEnd);

      const body = makeBody(sources, destinations);
      console.log(`➡️ Requesting ORS matrix tile r=${r} (${rowStart}-${rowEnd}) c=${c} (${colStart}-${colEnd})`);
      const result = await orsPost(`/matrix/driving-car`, body); // use "cycling-regular" if you prefer bike paths

      if (!result?.distances) {
        // if ORS returns error without throwing, guard it
        throw new Error(`ORS matrix tile returned no 'distances' for block r=${r}, c=${c}`);
      }

      // Stitch tile back into global matrix
      for (let i = 0; i < result.distances.length; i++) {
        const globalRow = rowStart + i;
        const rowArr = result.distances[i];
        for (let j = 0; j < rowArr.length; j++) {
          const globalCol = colStart + j;
          distances[globalRow][globalCol] = rowArr[j];
        }
      }

      // tiny pause to be gentle
      if (!(r === blocks - 1 && c === blocks - 1) && pauseMs > 0) {
        await new Promise((res) => setTimeout(res, pauseMs));
      }
    }
  }

  return distances;
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * Saves the distance matrix as a CSV file.
 * @param {*} ids
 * @param {*} distances
 * @param {*} outPath
 * @returns
 */
export async function saveMatrixCsv(ids, distances, outPath = "data/exports/distance_matrix_m.csv") {
  const N = ids.length;
  const lines = [];
  lines.push(["place_id", ...ids].join(","));
  for (let r = 0; r < N; r++) {
    const row = [ids[r], ...distances[r].map((v) => (v == null ? "" : Number(v).toFixed(2)))];
    lines.push(row.join(","));
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`✅ CSV written: ${outPath}`);
  return outPath;
}
