/* Disneyland Paris — Heat & Queue planning map
 * Pure Leaflet, no build step. All data comes from data/locations.json.
 */
(function () {
  "use strict";

  // ---- Display lookups -------------------------------------------------
  var CATEGORY_EMOJI = {
    attraction: "🎢",
    show: "🎭",
    restaurant: "🍴",
    shop: "🛍️",
    character: "🐭",
    amenity: "🚻"
  };
  var CATEGORY_LABEL = {
    attraction: "Attraction",
    show: "Show",
    restaurant: "Restaurant",
    shop: "Shop",
    character: "Character meet",
    amenity: "Amenity"
  };
  var QUEUE = {
    ac: { emoji: "❄️", label: "Air-conditioned queue" },
    shaded: { emoji: "⛱️", label: "Shaded / covered queue" },
    sun: { emoji: "☀️", label: "Full-sun queue" }
  };
  var VENUE = {
    "indoor-ac": { emoji: "🧊", label: "Indoor · air-conditioned" },
    indoor: { emoji: "🏠", label: "Indoor · not air-conditioned" },
    outdoor: { emoji: "🌳", label: "Outdoor" }
  };
  var PARK_LABEL = { DLP: "Disneyland Park", WDS: "Disney Adventure World" };

  var LABEL_MIN_ZOOM = 16; // labels only render when zoomed in this far (avoids clutter)

  // Rider height for the "can my child ride?" badge & filter. Defaults to 107 cm
  // but is adjustable from the ⚙️ settings modal and persisted to localStorage.
  var RIDER_HEIGHT_DEFAULT = 107;
  var RIDER_HEIGHT_MIN = 80;
  var RIDER_HEIGHT_MAX = 200;
  var RIDER_HEIGHT_KEY = "dlp-rider-height";

  function loadRiderHeight() {
    try {
      var v = parseInt(window.localStorage.getItem(RIDER_HEIGHT_KEY), 10);
      if (!isNaN(v) && v >= RIDER_HEIGHT_MIN && v <= RIDER_HEIGHT_MAX) return v;
    } catch (e) { /* localStorage unavailable */ }
    return RIDER_HEIGHT_DEFAULT;
  }
  var riderHeight = loadRiderHeight();

  // Icon size multiplier for map pins & badges. 1 = the default 34 px pin.
  // Adjustable from the ⚙️ settings modal and persisted to localStorage.
  var ICON_SCALE_DEFAULT = 1;
  var ICON_SCALE_MIN = 0.5;
  var ICON_SCALE_MAX = 3;
  var ICON_BASE_SIZE = 34; // px, must match .dlp-marker .pin in styles.css
  var ICON_SCALE_KEY = "dlp-icon-scale";

  function clampIconScale(s) {
    return Math.max(ICON_SCALE_MIN, Math.min(ICON_SCALE_MAX, s));
  }
  function loadIconScale() {
    try {
      var v = parseFloat(window.localStorage.getItem(ICON_SCALE_KEY));
      if (!isNaN(v) && v >= ICON_SCALE_MIN && v <= ICON_SCALE_MAX) return v;
    } catch (e) { /* localStorage unavailable */ }
    return ICON_SCALE_DEFAULT;
  }
  var iconScale = loadIconScale();
  // Expose the scale to CSS so pins/badges resize via calc(); see styles.css.
  document.documentElement.style.setProperty("--icon-scale", iconScale);

  function canRide(p) {
    return p.heightMin == null || p.heightMin <= riderHeight;
  }

  // ---- Map -------------------------------------------------------------
  var map = L.map("map", { zoomControl: true, maxZoom: 19, minZoom: 13 });
  L.control.scale({ imperial: false }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Fallback view (Marne-la-Vallée) until data bounds are known.
  map.setView([48.8705, 2.779], 16);

  // ---- State -----------------------------------------------------------
  var entries = []; // { props, marker }
  var filters = {
    park: new Set(["DLP", "WDS"]),
    category: new Set(["attraction", "show", "restaurant", "shop", "character", "amenity"]),
    queueEnv: new Set(["ac", "shaded", "sun"]),
    venueEnv: new Set(["indoor-ac", "indoor", "outdoor"]),
    premierAccessOnly: false,
    heightOk: false
  };
  var showLabels = true;

  // ---- Marker building -------------------------------------------------
  function buildIcon(p) {
    var cat = CATEGORY_EMOJI[p.category] || "📍";
    var q = QUEUE[p.queueEnv] || { emoji: "", label: "" };
    var v = VENUE[p.venueEnv] || { emoji: "", label: "" };
    var paBadge = p.premierAccess ? '<span class="badge pa" title="Premier Access">⚡</span>' : "";
    var html =
      '<div class="pin">' +
      cat +
      heightBadge(p) +
      '<span class="badge queue" title="' + q.label + '">' + q.emoji + "</span>" +
      '<span class="badge venue" title="' + v.label + '">' + v.emoji + "</span>" +
      paBadge +
      "</div>";
    var size = Math.round(ICON_BASE_SIZE * iconScale);
    var half = size / 2;
    return L.divIcon({
      className: "dlp-marker",
      html: html,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half + 1]
    });
  }

  // Permanent name label, offset to sit just right of the (scaled) pin.
  function labelOffset() {
    return [Math.round(14 * iconScale), 0];
  }
  function bindLabel(marker, p) {
    marker.bindTooltip(p.shortName || p.name, {
      permanent: true,
      direction: "right",
      offset: labelOffset(),
      className: "dlp-label"
    });
  }

  // Top-left badge: whether the configured rider height clears this attraction.
  // Only attractions get a badge; rides with no minimum read as ✅.
  function heightBadge(p) {
    if (p.category !== "attraction") return "";
    var ok = canRide(p);
    var title = ok
      ? (p.heightMin == null
          ? "OK for " + riderHeight + " cm — no height minimum"
          : "OK for " + riderHeight + " cm (needs " + p.heightMin + " cm)")
      : "Too short — needs " + p.heightMin + " cm";
    return '<span class="badge height ' + (ok ? "ok" : "no") + '" title="' + title + '">' +
      (ok ? "✅" : "🚫") + "</span>";
  }

  function passesFilters(p) {
    if (!filters.park.has(p.park)) return false;
    if (!filters.category.has(p.category)) return false;
    if (!filters.queueEnv.has(p.queueEnv)) return false;
    if (!filters.venueEnv.has(p.venueEnv)) return false;
    if (filters.premierAccessOnly && !p.premierAccess) return false;
    if (filters.heightOk && p.heightMin != null && p.heightMin > riderHeight) return false;
    return true;
  }

  // ---- Detail panel ----------------------------------------------------
  var detailEl = document.getElementById("detail");
  var detailBody = document.getElementById("detail-body");

  function attrRow(emoji, html) {
    return '<div class="attr"><span class="k">' + emoji + '</span><span class="v">' + html + "</span></div>";
  }

  function showDetail(p) {
    var q = QUEUE[p.queueEnv] || { emoji: "", label: "—" };
    var v = VENUE[p.venueEnv] || { emoji: "", label: "—" };
    var pa = p.premierAccess
      ? '<strong>Premier Access</strong> <span class="tag yes">Yes ⚡</span>'
      : '<strong>Premier Access</strong> <span class="tag no">No</span>';
    var height =
      p.heightMin == null
        ? "<strong>Height:</strong> no minimum"
        : "<strong>Height:</strong> " + p.heightMin + " cm minimum";

    var html =
      "<h2>" + p.name + "</h2>" +
      '<p class="subtitle">' +
      (CATEGORY_EMOJI[p.category] || "") + " " + (CATEGORY_LABEL[p.category] || p.category) +
      " · " + (PARK_LABEL[p.park] || p.park) + "</p>" +
      (p.summary ? '<p class="summary">' + p.summary + "</p>" : "") +
      attrRow("⚡", pa) +
      attrRow(q.emoji || "🚶", "<strong>Queue:</strong> " + q.label) +
      attrRow(v.emoji || "📍", "<strong>Venue:</strong> " + v.label) +
      attrRow("📏", height) +
      (p.heatNote ? '<div class="heatnote">🌡️ ' + p.heatNote + "</div>" : "");

    detailBody.innerHTML = html;
    detailEl.hidden = false;
  }

  document.getElementById("detail-close").addEventListener("click", function () {
    detailEl.hidden = true;
  });

  // ---- Labels ----------------------------------------------------------
  function labelsActive() {
    return showLabels && map.getZoom() >= LABEL_MIN_ZOOM;
  }
  function updateLabelVisibility() {
    var on = labelsActive();
    document.getElementById("map").classList.toggle("labels-off", !on);
  }
  map.on("zoomend", updateLabelVisibility);

  // ---- Apply filters ---------------------------------------------------
  var countEl = document.getElementById("count");
  function applyFilters() {
    var visible = 0;
    entries.forEach(function (e) {
      if (passesFilters(e.props)) {
        if (!map.hasLayer(e.marker)) e.marker.addTo(map);
        visible++;
      } else if (map.hasLayer(e.marker)) {
        map.removeLayer(e.marker);
      }
    });
    countEl.textContent = visible + " / " + entries.length + " shown";
  }

  // ---- Load data -------------------------------------------------------
  fetch("data/locations.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (geo) {
      var bounds = [];
      geo.features.forEach(function (f) {
        var c = f.geometry.coordinates; // [lng, lat]
        var latlng = [c[1], c[0]];
        var p = f.properties;
        var marker = L.marker(latlng, { icon: buildIcon(p) });
        bindLabel(marker, p);
        marker.on("click", function () {
          showDetail(p);
        });
        entries.push({ props: p, marker: marker });
        bounds.push(latlng);
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [60, 60] });
      }
      applyFilters();
      updateLabelVisibility();
    })
    .catch(function (err) {
      countEl.textContent = "Failed to load data";
      console.error("Could not load locations.json:", err);
    });

  // ---- Wire up the legend controls ------------------------------------
  document.querySelectorAll('input[data-filter]').forEach(function (input) {
    input.addEventListener("change", function () {
      var group = input.getAttribute("data-filter");
      var set = filters[group];
      if (input.checked) set.add(input.value);
      else set.delete(input.value);
      applyFilters();
    });
  });

  // Clicking a filter's *name* isolates it (show only that one). Clicking the
  // name again, when it is already the only active value, restores the group.
  // Generalised over data-isolate groups; only "category" is wired in the markup.
  function allValuesFor(group) {
    var vals = [];
    document.querySelectorAll('input[data-filter="' + group + '"]').forEach(function (i) {
      vals.push(i.value);
    });
    return vals;
  }

  function isolate(group, value) {
    var set = filters[group];
    var isOnlyThis = set.size === 1 && set.has(value);
    filters[group] = new Set(isOnlyThis ? allValuesFor(group) : [value]);
    document.querySelectorAll('input[data-filter="' + group + '"]').forEach(function (i) {
      i.checked = filters[group].has(i.value);
    });
    applyFilters();
  }

  document.querySelectorAll('[data-isolate]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      isolate(btn.getAttribute("data-isolate"), btn.getAttribute("data-value"));
    });
  });

  document.getElementById("filter-pa-only").addEventListener("change", function (e) {
    filters.premierAccessOnly = e.target.checked;
    applyFilters();
  });

  document.getElementById("filter-height-ok").addEventListener("change", function (e) {
    filters.heightOk = e.target.checked;
    applyFilters();
  });

  document.getElementById("filter-labels").addEventListener("change", function (e) {
    showLabels = e.target.checked;
    updateLabelVisibility();
  });

  document.getElementById("reset-filters").addEventListener("click", function () {
    filters.park = new Set(["DLP", "WDS"]);
    filters.category = new Set(["attraction", "show", "restaurant", "shop", "character", "amenity"]);
    filters.queueEnv = new Set(["ac", "shaded", "sun"]);
    filters.venueEnv = new Set(["indoor-ac", "indoor", "outdoor"]);
    filters.premierAccessOnly = false;
    filters.heightOk = false;
    document.querySelectorAll('input[data-filter]').forEach(function (i) { i.checked = true; });
    document.getElementById("filter-pa-only").checked = false;
    document.getElementById("filter-height-ok").checked = false;
    applyFilters();
  });

  // ---- Rider height & settings modal ----------------------------------
  // Badges are baked into each divIcon, so changing the height means rebuilding
  // the attraction icons; the filter label and any active filtering refresh too.
  function refreshHeightUI() {
    entries.forEach(function (e) {
      if (e.props.category === "attraction") e.marker.setIcon(buildIcon(e.props));
    });
    var cmEls = document.querySelectorAll(".rider-height-cm");
    for (var i = 0; i < cmEls.length; i++) cmEls[i].textContent = riderHeight;
    applyFilters();
  }

  function setRiderHeight(cm) {
    cm = parseInt(cm, 10);
    if (isNaN(cm)) return;
    cm = Math.max(RIDER_HEIGHT_MIN, Math.min(RIDER_HEIGHT_MAX, cm));
    riderHeight = cm;
    try { window.localStorage.setItem(RIDER_HEIGHT_KEY, String(cm)); } catch (e) { /* ignore */ }
    refreshHeightUI();
  }

  var settingsModal = document.getElementById("settings");
  var settingsBackdrop = document.getElementById("settings-backdrop");
  var heightInput = document.getElementById("rider-height-input");
  var lastFocus = null;

  function onSettingsKeydown(e) {
    if (e.key === "Escape") { closeSettings(); return; }
    if (e.key !== "Tab") return;
    var f = settingsModal.querySelectorAll("button, input");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openSettings() {
    heightInput.value = riderHeight;
    if (iconScaleInput) {
      iconScaleInput.value = iconScale;
      if (iconScaleVal) iconScaleVal.textContent = iconScale.toFixed(1) + "×";
    }
    lastFocus = document.activeElement;
    settingsBackdrop.hidden = false;
    settingsModal.hidden = false;
    heightInput.focus();
    heightInput.select();
    document.addEventListener("keydown", onSettingsKeydown);
  }
  function closeSettings() {
    settingsModal.hidden = true;
    settingsBackdrop.hidden = true;
    document.removeEventListener("keydown", onSettingsKeydown);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.getElementById("settings-open").addEventListener("click", openSettings);
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);
  // Live-update while typing only for in-range values; clamp & tidy on commit.
  heightInput.addEventListener("input", function () {
    var v = parseInt(heightInput.value, 10);
    if (!isNaN(v) && v >= RIDER_HEIGHT_MIN && v <= RIDER_HEIGHT_MAX) setRiderHeight(v);
  });
  heightInput.addEventListener("change", function () {
    setRiderHeight(heightInput.value);
    heightInput.value = riderHeight;
  });

  // Reflect the persisted height in the legend label / input on first load.
  (function initRiderHeight() {
    heightInput.value = riderHeight;
    var cmEls = document.querySelectorAll(".rider-height-cm");
    for (var i = 0; i < cmEls.length; i++) cmEls[i].textContent = riderHeight;
  })();

  // ---- Icon size --------------------------------------------------------
  // Pin/badge dimensions come from the --icon-scale CSS variable; the divIcon
  // size & anchor (and label offset) are baked in, so a change rebuilds icons.
  var iconScaleInput = document.getElementById("icon-scale-input");
  var iconScaleVal = document.getElementById("icon-scale-val");

  function rebuildAllIcons() {
    entries.forEach(function (e) {
      e.marker.setIcon(buildIcon(e.props));
      e.marker.unbindTooltip();
      bindLabel(e.marker, e.props);
    });
  }
  function refreshIconScaleUI() {
    document.documentElement.style.setProperty("--icon-scale", iconScale);
    if (iconScaleVal) iconScaleVal.textContent = iconScale.toFixed(1) + "×";
    rebuildAllIcons();
  }
  function setIconScale(s) {
    s = parseFloat(s);
    if (isNaN(s)) return;
    iconScale = clampIconScale(s);
    try { window.localStorage.setItem(ICON_SCALE_KEY, String(iconScale)); } catch (e) { /* ignore */ }
    refreshIconScaleUI();
  }

  iconScaleInput.addEventListener("input", function () {
    setIconScale(iconScaleInput.value);
  });

  (function initIconScale() {
    iconScaleInput.value = iconScale;
    if (iconScaleVal) iconScaleVal.textContent = iconScale.toFixed(1) + "×";
  })();

  // ---- Restore defaults -------------------------------------------------
  // Resets the settings-menu options (rider height + icon size) to their
  // defaults, clears their stored values, and refreshes the map. Legend
  // filters have their own "Reset filters" control and are left untouched.
  function restoreDefaults() {
    if (!window.confirm("Restore all settings to their default values?")) return;
    riderHeight = RIDER_HEIGHT_DEFAULT;
    iconScale = ICON_SCALE_DEFAULT;
    try {
      window.localStorage.removeItem(RIDER_HEIGHT_KEY);
      window.localStorage.removeItem(ICON_SCALE_KEY);
    } catch (e) { /* localStorage unavailable */ }
    refreshHeightUI();
    refreshIconScaleUI();
    heightInput.value = riderHeight;
    iconScaleInput.value = iconScale;
  }
  document.getElementById("restore-defaults").addEventListener("click", restoreDefaults);

  // ---- Current location (GPS) -----------------------------------------
  // A live "blue dot" driven by watchPosition. The map does NOT auto-follow;
  // it only recenters once on the first fix and whenever the user asks (🎯).
  var locateToggle = document.getElementById("locate-toggle");
  var locateRecenter = document.getElementById("locate-recenter");
  var locationWatchId = null;
  var locationMarker = null;
  var accuracyCircle = null;
  var lastLocation = null; // L.latLng of the most recent fix

  var locationIcon = L.divIcon({
    className: "dlp-location",
    html: '<div class="dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  function locationSupported() {
    return "geolocation" in navigator;
  }

  function onLocationFound(pos) {
    var latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    var firstFix = lastLocation === null;
    lastLocation = latlng;

    if (locationMarker) {
      locationMarker.setLatLng(latlng);
    } else {
      locationMarker = L.marker(latlng, {
        icon: locationIcon,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(map);
    }

    if (accuracyCircle) {
      accuracyCircle.setLatLng(latlng).setRadius(pos.coords.accuracy);
    } else {
      accuracyCircle = L.circle(latlng, {
        radius: pos.coords.accuracy,
        color: "#1a73e8",
        weight: 1,
        fillColor: "#1a73e8",
        fillOpacity: 0.12,
        interactive: false
      }).addTo(map);
    }

    locateRecenter.hidden = false;
    // Recenter once when tracking first acquires a position, then leave the
    // map alone so it never fights the user's panning.
    if (firstFix) recenterOnLocation();
  }

  function onLocationError(err) {
    stopTracking();
    var msg = "Could not get your location.";
    if (err && err.code === 1) msg = "Location permission denied. Enable it in your browser to use this feature.";
    else if (err && err.code === 3) msg = "Timed out while finding your location. Please try again.";
    window.alert(msg);
  }

  function recenterOnLocation() {
    if (!lastLocation) return;
    map.setView(lastLocation, Math.max(map.getZoom(), 17));
  }

  function startTracking() {
    if (!locationSupported()) {
      window.alert("Your browser does not support location services.");
      return;
    }
    locationWatchId = navigator.geolocation.watchPosition(
      onLocationFound,
      onLocationError,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    locateToggle.classList.add("active");
    locateToggle.setAttribute("aria-pressed", "true");
  }

  function stopTracking() {
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }
    if (locationMarker) { map.removeLayer(locationMarker); locationMarker = null; }
    if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
    lastLocation = null;
    locateToggle.classList.remove("active");
    locateToggle.setAttribute("aria-pressed", "false");
    locateRecenter.hidden = true;
  }

  if (locationSupported()) {
    locateToggle.addEventListener("click", function () {
      if (locationWatchId === null) startTracking();
      else stopTracking();
    });
    locateRecenter.addEventListener("click", recenterOnLocation);
  } else {
    locateToggle.hidden = true;
  }

  // ---- Legend collapse -------------------------------------------------
  var legendToggle = document.getElementById("legend-toggle");
  var legendBody = document.getElementById("legend-body");
  legendToggle.addEventListener("click", function () {
    var expanded = legendToggle.getAttribute("aria-expanded") === "true";
    legendToggle.setAttribute("aria-expanded", String(!expanded));
    legendBody.hidden = expanded;
  });
})();
