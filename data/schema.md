# `locations.json` data schema

The map is driven entirely by `data/locations.json`, a [GeoJSON](https://geojson.org/)
`FeatureCollection`. To add, remove, or correct a location, edit this one file — no code
changes are needed. Each entry is a GeoJSON `Feature` with a `Point` geometry and the
properties below.

```jsonc
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [LONGITUDE, LATITUDE] },
  "properties": {
    "id": "kebab-case-unique-id",
    "name": "Display name shown on the label and detail panel",
    "park": "DLP",                // "DLP" = Disneyland Park, "WDS" = Disney Adventure World (ex-Walt Disney Studios)
    "category": "attraction",     // attraction | show | restaurant | shop | character | amenity
    "premierAccess": true,        // true if eligible for Premier Access / Premier Access Ultimate
    "queueEnv": "sun",            // queue environment: "ac" | "shaded" | "sun"
    "venueEnv": "outdoor",        // the experience itself: "indoor-ac" | "indoor" | "outdoor"
    "heightMin": 102,             // minimum rider height in cm, or null if there is no restriction
    "heatNote": "Free-text heat / strategy tip shown in the detail panel."
  }
}
```

## Field reference

| Field | Required | Values | Meaning |
|-------|----------|--------|---------|
| `geometry.coordinates` | yes | `[lng, lat]` | **Longitude first**, then latitude (GeoJSON order). |
| `id` | yes | unique string | Stable identifier. |
| `name` | yes | string | Shown as the marker label and detail-panel title. |
| `park` | yes | `DLP`, `WDS` | Used by the per-park toggle. |
| `category` | yes | `attraction`, `show`, `restaurant`, `shop`, `character`, `amenity` | Drives the marker emoji and the category filter. |
| `premierAccess` | yes | `true` / `false` | `true` adds the ⚡ badge and is matched by the Premier Access filter. |
| `queueEnv` | yes | `ac`, `shaded`, `sun` | Queue heat exposure. Adds the ❄️ / ⛱️ / ☀️ badge and drives the "queue comfort" filter. |
| `venueEnv` | yes | `indoor-ac`, `indoor`, `outdoor` | The experience/venue itself; drives the "venue" filter. |
| `heightMin` | yes | integer cm or `null` | Minimum rider height; `null` = no restriction. |
| `heatNote` | yes | string | Short strategy note in the detail panel. |

## Heat model (two dimensions)

`queueEnv` and `venueEnv` are deliberately separate. Big Thunder Mountain is `queueEnv: "sun"`
(the line bakes in the open) and `venueEnv: "outdoor"`. Star Tours is `queueEnv: "ac"` and
`venueEnv: "indoor-ac"`. An attraction can be a cool ride with a hot queue, so the two fields
are filtered independently in the legend.

## Accuracy note

Coordinates are sourced from **OpenStreetMap** (Overpass API, June 2026) and should be accurate
to each attraction's footprint. The only exceptions are the brand-new World of Frozen rides
(Frozen Ever After and its show/shop), which are not yet mapped in OSM and were placed within the
correct land by anchoring to their mapped neighbours. Premier Access / A/C / height values are
curated from public 2026 sources. Treat the curated attributes as best-effort and correct anything
you spot — it is a one-line edit here.
