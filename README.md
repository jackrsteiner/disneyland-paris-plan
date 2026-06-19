# Disneyland Paris — Heat & Queue Planning Map

An interactive map for a **hot-weather day at Disneyland Paris** (planned visit:
**Monday 22 June 2026**, forecast ~38–39 °C). The whole point is to **move through the parks
efficiently, avoid queues, and survive the heat** — so at a glance you can see which
attractions, shows, restaurants and shops are air-conditioned refuges and which bake in the sun.

➡️ **Live map:** https://jackrsteiner.github.io/disneyland-paris-plan/

## Why this exists

We have **Premier Access Ultimate**, a 3-year-old, a knee injury, and extreme heat. With
Premier Access removing most ride queues, the real challenges become **heat exposure, walking,
food queues and child fatigue** (see [`Initial-chat.md`](./Initial-chat.md) for the full
strategy). The plan that falls out of that:

- **Morning (09:30–11:30):** use Premier Access aggressively on the headliners.
- **Early lunch (~11:15):** beat the rush and gain air-conditioning.
- **Midday (12:00–17:00):** hide from the heat — indoor rides, indoor shows, A/C restaurants and shops.
- **Evening (after 18:30):** the most pleasant touring window; spend remaining Premier Access on outdoor rides.

This map turns that strategy into something you can see and filter on the ground.

## What the map shows

Each location is a marker built from three glanceable signals:

- **Category emoji** — 🎢 attraction · 🎭 show · 🍴 restaurant · 🛍️ shop · 🐭 character meet · 🚻 amenity.
- **Queue-comfort badge** (bottom-left) — ❄️ air-conditioned queue · ⛱️ shaded/covered · ☀️ full sun.
  *(This is why Big Thunder Mountain reads as a ride with a ☀️ sun-baked queue, while Star Tours reads as ❄️.)*
- **Premier Access badge** (bottom-right) — ⚡ means the attraction accepts Premier Access.

The **name label** sits next to each marker (visible when you zoom in; toggle it in the legend).

**Click any marker** to open a detail panel with: Premier Access (yes/no), queue comfort,
venue type (indoor A/C / indoor / outdoor), the **minimum rider height**, and a short
**heat-strategy note** for that spot.

### Heat model: queue vs. venue

Air-conditioning is tracked as **two independent things**, because they often differ:

1. **Queue comfort** — what the *line* is like (the heat you actually stand in).
2. **Venue** — what the *experience itself* is like (the ride/show/room).

So an attraction can be a cool ride with a hot queue. Both are filterable separately.

## Legend = filters

The legend on the left is also the filter panel — tick/untick to show or hide locations.
A marker appears only if it passes **every** group:

- **Parks** — Disneyland Park / Disney Adventure World, each toggled independently.
- **Categories** — attractions, shows, restaurants, shops, characters, amenities.
- **Queue comfort** — ❄️ / ⛱️ / ☀️.
- **Venue** — indoor A/C / indoor / outdoor.
- **Premier Access** — show only Premier Access locations.
- **Labels** — show/hide the name labels.

Pan and zoom freely; the map is built on OpenStreetMap tiles. *Disney Adventure World* is the
reimagined second park (formerly Walt Disney Studios), reopened 29 March 2026 with World of Frozen.

## Editing the data

All locations live in **[`data/locations.json`](./data/locations.json)** (GeoJSON). To add or
correct anything, edit that one file — no code changes needed. The fields are documented in
**[`data/schema.md`](./data/schema.md)**.

> **Accuracy note:** coordinates are approximate (placed by park layout) and the Premier Access /
> A/C / height values are curated from public 2026 information. Treat them as a best-effort
> starting point and correct anything you spot — it is a one-line edit.

## Project structure

```
index.html            # page, legend/filter panel, detail panel (loads Leaflet from CDN)
css/styles.css        # layout, marker, legend and panel styling
js/app.js             # map setup, markers, filtering, labels, detail panel
data/locations.json   # the curated dataset (edit this to change the map)
data/schema.md        # field-by-field data documentation
.github/workflows/deploy.yml   # auto-deploy to GitHub Pages
Initial-chat.md       # original heat & queue planning notes
```

## Running locally

It is a static site — no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

(Opening `index.html` directly with `file://` will not work, because the browser blocks
`fetch()` of the local JSON — use a local server.)

## Deployment

Pushes to `main` are published to GitHub Pages by `.github/workflows/deploy.yml`. **One-time
setup:** in the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
