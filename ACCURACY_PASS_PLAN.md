# Plan: Fix marker positions & add missing attractions (full accuracy pass)

> **Status:** ✅ **Done** (2026-06-20, branch `claude/poi-locations-missing-points-g2v5nf`).
> OpenStreetMap hosts were allowlisted; coordinates for all existing markers were rebuilt from
> the Overpass API and 17 missing attractions/shows were added. The notes below are kept as a
> record of the approach. Brand-new World of Frozen rides (Frozen Ever After + its show/shop) are
> still untagged in OSM and were anchored within the correct land via their mapped neighbours.

## Context

The map's coordinates were placed by hand from park-layout memory, because every OSM/geocoding
host is blocked by this environment's network egress allowlist. As a result several markers sit
in the wrong spot and some attractions are missing entirely. Flagged by the user: the
Discoveryland cluster (Space Mountain, Orbitron, Buzz Lightyear, Star Tours, Autopia — present
but mispositioned) and genuinely-missing rides (Les Mystères du Nautilus, Videopolis, more
railroad stations).

**Decisions (confirmed):** (1) pull authoritative coordinates from **OpenStreetMap** once the
host is allowlisted; (2) do a **full accuracy + completeness pass** — reposition every existing
marker and add all notable missing attractions across both parks.

## Prerequisite: allowlist OpenStreetMap (USER ACTION, do this first)

Every map-data host currently returns `403 Host not in allowlist`. Before resuming:

1. Add these hosts to the environment's **network egress allowlist** (Claude Code on the web
   environment settings / network policy — https://code.claude.com/docs/en/claude-code-on-the-web):
   - `overpass-api.de` (primary — bulk coordinates)
   - `nominatim.openstreetmap.org` (fallback single-lookup)
   - *(optional mirror if overpass-api.de is busy:* `overpass.kumi.systems`*)*
2. The allowlist applies per environment, so **start a fresh web session** on this repo +
   branch after changing it.
3. Resuming Claude should re-test reachability first:
   `curl -s -o /dev/null -w "%{http_code}" https://overpass-api.de/api/status` → expect `200`.
   If still `403`, stop and tell the user (do not hand-guess coordinates).

## Implementation

### 1. Pull authoritative geometry from Overpass

Query the resort bounding box (~`48.865,2.770,48.877,2.788`, both parks) and use `out center`
so ways/relations return a centroid:

```
[out:json][timeout:90];
( node["name"]["tourism"~"attraction|theme_park|artwork"](48.865,2.770,48.877,2.788);
  way ["name"]["tourism"~"attraction|theme_park"](48.865,2.770,48.877,2.788);
  nwr ["name"]["attraction"](48.865,2.770,48.877,2.788);
  nwr ["name"]["amenity"~"restaurant|fast_food|cafe|theatre|first_aid"](48.865,2.770,48.877,2.788);
  nwr ["name"]["shop"](48.865,2.770,48.877,2.788);
  nwr ["name"]["railway"="station"](48.865,2.770,48.877,2.788);
);
out center tags;
```

Send with `curl --data-urlencode "data@query.ql" https://overpass-api.de/api/interpreter`.
Save the raw response to a scratch file (e.g. `data/osm-raw.json`, git-ignored — do NOT commit).

### 2. Rebuild `data/locations.json` (the only data file the app reads)

OSM gives **name + coordinates + existence**; it does NOT have our heat/queue/Premier Access
attributes — those stay curated. Merge strategy:

- **Match** each OSM feature to existing entries by name (normalise accents/case). For matches,
  **overwrite `geometry.coordinates`** with the OSM `[lon, lat]` / `center`; keep the curated
  `premierAccess`, `queueEnv`, `venueEnv`, `heightMin`, `heatNote`.
- **Add** notable attractions present in OSM but missing, with curated attributes. Expected
  additions (final list driven by what OSM returns):
  - *Discoveryland:* Les Mystères du Nautilus (indoor walkthrough), Videopolis Théâtre
    (indoor-A/C show venue — heat refuge).
  - *Fantasyland:* Blanche-Neige et les Sept Nains (Snow White), Les Voyages de Pinocchio,
    Casey Jr, La Tanière du Dragon, Princess Pavilion.
  - *Frontierland:* Thunder Mesa Riverboat Landing, Pocahontas Indian Village, Rustler Roundup
    Shootin' Gallery.
  - *Adventureland:* Le Passage Enchanté d'Aladdin, La Cabane des Robinson, Pirates' Beach.
  - *Main Street:* Discovery/Liberty Arcades (covered A/C walkways — useful heat refuges),
    Main Street Vehicles, and the Frontierland / Fantasyland / Discoveryland **railroad stations**.
  - *Disney Adventure World:* Cars Quatre Roues Rallye and any other named rides OSM returns not
    already present.
- **Curate attributes for each addition** following the existing patterns in `data/locations.json`
  and the established indoor/outdoor classifications (e.g. arcades & Videopolis =
  `queueEnv: ac` / `venueEnv: indoor-ac`; Nautilus = `shaded` / `indoor`; outdoor flat rides =
  `sun` / `outdoor`). Keep the GeoJSON shape and field set documented in `data/schema.md`.
- **Rename for clarity:** `star-wars-hyperspace-mountain` → display name
  "Star Wars Hyperspace Mountain (Space Mountain)" so it's findable as Space Mountain.

### 3. No code changes expected

`js/app.js` and `css/styles.css` already render whatever is in `locations.json`; the 3-badge
work from PR #2 is unaffected. Update `data/locations.json` `metadata.lastUpdated` and the
accuracy note to say coordinates are now OSM-sourced; refresh the `data/schema.md` accuracy note.

## Verification

1. `curl -s https://overpass-api.de/api/status` returns 200 (allowlist active).
2. `python3 -c "import json; d=json.load(open('data/locations.json')); print(len(d['features']))"`
   — JSON valid, feature count grew by the additions.
3. Serve locally (`python3 -m http.server 8000`) and confirm Discoveryland rides (Space Mountain,
   Orbitron, Buzz, Star Tours, Autopia) now sit together in the south-east of Disneyland Park, and
   Nautilus + Videopolis appear there too.
4. Spot-check 4–5 markers against the real park (Big Thunder on its island, Phantom Manor at the
   end of Frontierland) — positions look right, no stray markers in car parks/lakes.
5. Confirm both-park toggle, category, queue/venue, and Premier Access filters still work and the
   3 badges still render.
6. Commit to `claude/disneyland-paris-map-wsgmoa` (updates open PR #2) and push.

## Fallback

If OpenStreetMap cannot be allowlisted, fall back to a **manual best-effort** reposition + the
same set of additions (positions approximate). Only do this with the user's go-ahead, since OSM
was chosen specifically for accuracy.
