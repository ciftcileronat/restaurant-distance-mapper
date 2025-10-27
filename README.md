# 🍽️ restaurant-distance-mapper

**restaurant-distance-mapper** is a complete Node.js pipeline for extracting, geocoding, and mapping distances between restaurants in Dublin (or any city).  
It automates restaurant discovery from **Deliveroo**, retrieves geospatial data via **Google Maps APIs**, and computes pairwise distances using a **self-hosted OpenRouteService (ORS)** Docker instance.

---

## 🚀 Features

- **Automated restaurant discovery**  
  Uses [Playwright](https://playwright.dev/) to crawl Deliveroo pages and extract restaurant names dynamically.

- **Data enrichment via Google APIs**  
  Uses **Places**, **Geocoding**, and **Routes** APIs to find coordinates and addresses for each restaurant.

- **Distance matrix computation**  
  Computes real-road distances (in meters) between every restaurant pair using **OpenRouteService** running locally in Docker.

- **Smart batching**  
  Automatically tiles requests into safe batches (e.g. 50×50) to handle hundreds of locations efficiently.

- **Exportable results**  
  Outputs:
  - JSON data (IDs, names, coordinates, distances)
  - Excel/CSV files with full NxN matrix and legend mapping

- **Local & reproducible**  
  Uses a Dockerized ORS instance with Dublin OSM data for consistent, privacy-safe computation.

---

## 📊 Output Example

### 📏 Distance Matrix File (`distance_matrix_m.csv`)
An NxN grid of distances (in meters) between each restaurant.
The diagonal (`0`) represents the distance from a location to itself.

| place_id | ChIJaXK... | ChIJfZV... | ChIJcRZ... |
|-----------|------------|------------|------------|
| **ChIJaXK...** | 0 | 3615.65 | 2789.33 |
| **ChIJfZV...** | 1594.81 | 0 | 1672.22 |
| **ChIJcRZ...** | 2481.15 | 1894.57 | 0 |


