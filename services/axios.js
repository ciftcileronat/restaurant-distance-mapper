import axios from "axios";

const ORS_BASE_URL = "http://localhost:8080/ors/v2";
const ORS_API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;

const ors_client = axios.create({
  baseURL: ORS_BASE_URL,
  timeout: 120000,
  proxy: false,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
    ...(ORS_API_KEY && { Authorization: ORS_API_KEY }),
  },
});

export async function orsGet(endpoint, params = {}) {
  try {
    const res = await ors_client.get(endpoint, { params });
    return res.data;
  } catch (err) {
    handleOrsError(err);
  }
}

export async function orsPost(endpoint, body = {}) {
  try {
    const res = await ors_client.post(endpoint, body);
    return res.data;
  } catch (err) {
    handleOrsError(err);
  }
}

function handleOrsError(err) {
  if (err.response) {
    console.error(`❌ ORS HTTP ${err.response.status}:`, err.response.data);
  } else {
    console.error(`🚨 ORS connection error: ${err.message}`);
  }
  throw err;
}
