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
    premierAccessOnly: false
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
      '<span class="badge queue" title="' + q.label + '">' + q.emoji + "</span>" +
      '<span class="badge venue" title="' + v.label + '">' + v.emoji + "</span>" +
      paBadge +
      "</div>";
    return L.divIcon({
      className: "dlp-marker",
      html: html,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16]
    });
  }

  function passesFilters(p) {
    if (!filters.park.has(p.park)) return false;
    if (!filters.category.has(p.category)) return false;
    if (!filters.queueEnv.has(p.queueEnv)) return false;
    if (!filters.venueEnv.has(p.venueEnv)) return false;
    if (filters.premierAccessOnly && !p.premierAccess) return false;
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
        marker.bindTooltip(p.name, {
          permanent: true,
          direction: "right",
          offset: [14, 0],
          className: "dlp-label"
        });
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

  document.getElementById("filter-pa-only").addEventListener("change", function (e) {
    filters.premierAccessOnly = e.target.checked;
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
    document.querySelectorAll('input[data-filter]').forEach(function (i) { i.checked = true; });
    document.getElementById("filter-pa-only").checked = false;
    applyFilters();
  });

  // ---- Legend collapse -------------------------------------------------
  var legendToggle = document.getElementById("legend-toggle");
  var legendBody = document.getElementById("legend-body");
  legendToggle.addEventListener("click", function () {
    var expanded = legendToggle.getAttribute("aria-expanded") === "true";
    legendToggle.setAttribute("aria-expanded", String(!expanded));
    legendBody.hidden = expanded;
  });
})();
