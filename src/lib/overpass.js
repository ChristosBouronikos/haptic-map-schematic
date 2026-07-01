export const FEATURE_TYPES = {
  roads: {
    label: "Roads",
    greek: "Δρόμοι",
    query: [
      'way["highway"]({bbox});'
    ],
    limit: 700
  },
  buildings: {
    label: "Buildings",
    greek: "Κτίρια",
    query: [
      'way["building"]({bbox});',
      'relation["building"]({bbox});'
    ],
    limit: 900
  },
  parks: {
    label: "Parks",
    greek: "Πάρκα",
    query: [
      'way["leisure"~"^(park|garden|playground|sports_centre)$"]({bbox});',
      'relation["leisure"~"^(park|garden|playground|sports_centre)$"]({bbox});',
      'way["landuse"~"^(grass|recreation_ground|forest|meadow|village_green|cemetery)$"]({bbox});',
      'relation["landuse"~"^(grass|recreation_ground|forest|meadow|village_green|cemetery)$"]({bbox});',
      'way["natural"~"^(wood|grassland)$"]({bbox});',
      'relation["natural"~"^(wood|grassland)$"]({bbox});'
    ],
    limit: 260
  },
  churches: {
    label: "Churches",
    greek: "Εκκλησίες",
    query: [
      'node["amenity"="place_of_worship"]({bbox});',
      'way["amenity"="place_of_worship"]({bbox});',
      'relation["amenity"="place_of_worship"]({bbox});',
      'way["building"~"^(church|cathedral|chapel)$"]({bbox});'
    ],
    limit: 140
  },
  schools: {
    label: "Schools",
    greek: "Σχολεία",
    query: [
      'node["amenity"~"^(school|kindergarten|college|university)$"]({bbox});',
      'way["amenity"~"^(school|kindergarten|college|university)$"]({bbox});',
      'relation["amenity"~"^(school|kindergarten|college|university)$"]({bbox});',
      'way["building"="school"]({bbox});'
    ],
    limit: 140
  },
  water: {
    label: "Water",
    greek: "Νερό",
    query: [
      'way["natural"="water"]({bbox});',
      'relation["natural"="water"]({bbox});',
      'way["waterway"]({bbox});',
      'way["landuse"~"^(reservoir|basin)$"]({bbox});',
      'relation["landuse"~"^(reservoir|basin)$"]({bbox});'
    ],
    limit: 240
  },
  transit: {
    label: "Transit",
    greek: "Συγκοινωνία",
    query: [
      'way["railway"]({bbox});',
      'node["highway"="bus_stop"]({bbox});',
      'node["public_transport"]({bbox});',
      'way["public_transport"]({bbox});'
    ],
    limit: 180
  },
  medical: {
    label: "Medical",
    greek: "Υγεία",
    query: [
      'node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]({bbox});',
      'way["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]({bbox});',
      'relation["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]({bbox});'
    ],
    limit: 120
  },
  public: {
    label: "Public services",
    greek: "Δημόσιες υπηρεσίες",
    query: [
      'node["amenity"~"^(townhall|library|police|fire_station|post_office|courthouse)$"]({bbox});',
      'way["amenity"~"^(townhall|library|police|fire_station|post_office|courthouse)$"]({bbox});',
      'relation["amenity"~"^(townhall|library|police|fire_station|post_office|courthouse)$"]({bbox});'
    ],
    limit: 120
  }
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];

const REQUEST_TIMEOUT_MS = 18000;

export function buildOverpassQuery(bounds, categories) {
  const bbox = [
    bounds.south.toFixed(7),
    bounds.west.toFixed(7),
    bounds.north.toFixed(7),
    bounds.east.toFixed(7)
  ].join(",");

  const statements = categories
    .flatMap((category) => FEATURE_TYPES[category]?.query ?? [])
    .map((statement) => statement.replaceAll("{bbox}", bbox))
    .join("\n  ");

  return `[out:json][timeout:35];
(
  ${statements}
);
out body geom qt;`;
}

export async function fetchOsmFeatures(bounds, categories) {
  const query = buildOverpassQuery(bounds, categories);
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await postWithTimeout(endpoint, query);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      return normalizeOsmElements(payload.elements ?? [], categories, endpoint);
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  throw new Error(errors.join("\n"));
}

async function postWithTimeout(endpoint, query) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: new URLSearchParams({ data: query })
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function normalizeOsmElements(elements, enabledCategories, endpoint = "local") {
  const enabled = new Set(enabledCategories);
  const features = [];
  const counts = Object.fromEntries(Object.keys(FEATURE_TYPES).map((key) => [key, 0]));
  const rawCounts = { node: 0, way: 0, relation: 0 };

  for (const element of elements) {
    rawCounts[element.type] = (rawCounts[element.type] ?? 0) + 1;
    const category = classifyTags(element.tags ?? {});

    if (!category || !enabled.has(category)) {
      continue;
    }

    const geometries = geometriesFromElement(element, category);
    for (const geometry of geometries) {
      if (geometry.points.length === 0) {
        continue;
      }

      features.push({
        id: `${element.type}/${element.id}/${features.length}`,
        osmId: `${element.type}/${element.id}`,
        category,
        type: geometry.type,
        points: geometry.points,
        label: getLabel(element.tags ?? {}),
        tags: element.tags ?? {},
        importance: getImportance(category, element.tags ?? {}, geometry.points)
      });
      counts[category] += 1;
    }
  }

  const limited = [];
  const truncatedByCategory = {};

  for (const category of Object.keys(FEATURE_TYPES)) {
    const categoryFeatures = features
      .filter((feature) => feature.category === category)
      .sort((a, b) => b.importance - a.importance);
    const limit = FEATURE_TYPES[category].limit;
    limited.push(...categoryFeatures.slice(0, limit));
    truncatedByCategory[category] = Math.max(0, categoryFeatures.length - limit);
  }

  return {
    features: limited,
    meta: {
      endpoint,
      rawCounts,
      counts,
      returned: features.length,
      rendered: limited.length,
      truncated: Object.values(truncatedByCategory).reduce((sum, value) => sum + value, 0),
      truncatedByCategory
    }
  };
}

function geometriesFromElement(element, category) {
  if (element.type === "node") {
    return [{ type: "point", points: [{ lat: element.lat, lon: element.lon }] }];
  }

  if (element.type === "way") {
    const points = geometryToPoints(element.geometry);
    if (points.length === 0) {
      return [];
    }
    return [{ type: geometryTypeFromTags(element.tags ?? {}, points, category), points }];
  }

  if (element.type === "relation") {
    return (element.members ?? [])
      .filter((member) => member.geometry?.length)
      .map((member) => {
        const points = geometryToPoints(member.geometry);
        const type = member.role === "outer" || isPolygonCategory(category) ? "polygon" : "line";
        return { type, points };
      });
  }

  return [];
}

function geometryToPoints(geometry = []) {
  return geometry
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    .map((point) => ({ lat: point.lat, lon: point.lon }));
}

function geometryTypeFromTags(tags, points, category) {
  if (category === "roads" || tags.highway || tags.railway || tags.waterway) {
    return "line";
  }

  if (isClosed(points) || isPolygonCategory(category)) {
    return "polygon";
  }

  return "line";
}

function isClosed(points) {
  if (points.length < 3) {
    return false;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return Math.abs(first.lat - last.lat) < 0.000001 && Math.abs(first.lon - last.lon) < 0.000001;
}

function isPolygonCategory(category) {
  return ["buildings", "parks", "water", "schools", "churches", "medical", "public"].includes(category);
}

function classifyTags(tags) {
  if (tags.amenity === "place_of_worship" || ["church", "cathedral", "chapel"].includes(tags.building)) {
    return "churches";
  }

  if (["school", "kindergarten", "college", "university"].includes(tags.amenity) || tags.building === "school") {
    return "schools";
  }

  if (["hospital", "clinic", "doctors", "pharmacy"].includes(tags.amenity)) {
    return "medical";
  }

  if (["townhall", "library", "police", "fire_station", "post_office", "courthouse"].includes(tags.amenity)) {
    return "public";
  }

  if (tags.natural === "water" || tags.waterway || ["reservoir", "basin"].includes(tags.landuse)) {
    return "water";
  }

  if (
    ["park", "garden", "playground", "sports_centre"].includes(tags.leisure) ||
    ["grass", "recreation_ground", "forest", "meadow", "village_green", "cemetery"].includes(tags.landuse) ||
    ["wood", "grassland"].includes(tags.natural)
  ) {
    return "parks";
  }

  if (tags.railway || tags.public_transport || tags.highway === "bus_stop") {
    return "transit";
  }

  if (tags.highway) {
    return "roads";
  }

  if (tags.building) {
    return "buildings";
  }

  return null;
}

function getLabel(tags) {
  return tags["name:el"] || tags.name || tags["name:en"] || tags.ref || "";
}

function getImportance(category, tags, points) {
  let score = Math.min(points.length, 80) / 20;

  if (tags.name || tags["name:el"]) {
    score += 6;
  }

  if (category === "roads") {
    const roadRank = {
      motorway: 10,
      trunk: 9,
      primary: 8,
      secondary: 6,
      tertiary: 5,
      residential: 3,
      service: 1,
      footway: 1,
      path: 1
    };
    score += roadRank[tags.highway] ?? 2;
  }

  if (["schools", "churches", "medical", "public"].includes(category)) {
    score += 9;
  }

  if (["parks", "water"].includes(category)) {
    score += 5;
  }

  if (category === "buildings") {
    score += tags.amenity ? 4 : 0;
  }

  return score;
}
