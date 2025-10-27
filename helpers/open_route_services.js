import axios from "axios";

const API_KEY = process.env.OPEN_ROUTE_SERVICE_API_KEY;
const ORS_BASE_URL = "http://localhost:8080/ors/v2";

export async function healthORS() {
  const health_url = `${ORS_BASE_URL}/health`;

  try {
    const response = await axios.get(health_url, {
      timeout: 5000, // 5 seconds timeout
    });
    console.log("✅ ORS Health Check:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error(`❌ ORS Health Check error: ${err.response.status} ${err.response.statusText}`);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(`🚨 Connection or Axios error: ${err.message}`);
    }
  }
}
