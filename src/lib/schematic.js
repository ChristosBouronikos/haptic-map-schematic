import { FEATURE_TYPES } from "./overpass";
import { toGreekBraille } from "./greekBraille";

const CATEGORY_STYLE = {
  water: {
    stroke: "#5d7180",
    fill: "url(#waterPattern)",
    symbol: "wave"
  },
  parks: {
    stroke: "#6f7a61",
    fill: "url(#parkPattern)",
    symbol: "dots"
  },
  buildings: {
    stroke: "#3a3936",
    fill: "url(#buildingPattern)",
    symbol: "hatch"
  },
  roads: {
    stroke: "#272725",
    fill: "none",
    symbol: "road"
  },
  churches: {
    stroke: "#7a6657",
    fill: "url(#churchPattern)",
    symbol: "cross"
  },
  schools: {
    stroke: "#8b7854",
    fill: "url(#schoolPattern)",
    symbol: "square"
  },
  transit: {
    stroke: "#6d7376",
    fill: "url(#transitPattern)",
    symbol: "rail"
  },
  medical: {
    stroke: "#8b6b64",
    fill: "url(#medicalPattern)",
    symbol: "plus"
  },
  public: {
    stroke: "#6f6b73",
    fill: "url(#publicPattern)",
    symbol: "diamond"
  }
};

const ORDER = ["water", "parks", "buildings", "schools", "churches", "medical", "public", "transit", "roads"];
const LANDMARK_LABEL_CATEGORIES = new Set(["schools", "churches", "medical", "public", "parks"]);

const PRESET_OVERRIDES = {
  highContrast: {
    water: { stroke: "#23495f", fill: "url(#waterPattern)" },
    parks: { stroke: "#3d5637", fill: "url(#parkPattern)" },
    buildings: { stroke: "#111111", fill: "url(#buildingPattern)" },
    churches: { stroke: "#5f493d", fill: "url(#churchPattern)" },
    schools: { stroke: "#6b5b37", fill: "url(#schoolPattern)" },
    medical: { stroke: "#6b4a46", fill: "url(#medicalPattern)" },
    public: { stroke: "#53545a", fill: "url(#publicPattern)" },
    transit: { stroke: "#34383a", fill: "url(#transitPattern)" }
  },
  laser: {
    water: { fill: "#ffffff" },
    parks: { fill: "#ffffff" },
    buildings: { fill: "#ffffff" },
    churches: { fill: "#ffffff" },
    schools: { fill: "#ffffff" },
    medical: { fill: "#ffffff" },
    public: { fill: "#ffffff" },
    transit: { fill: "#ffffff" }
  }
};

export const PAPER = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 }
};

function getCategoryStyle(category, options = {}) {
  const base = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.public;
  const override = PRESET_OVERRIDES[options.presetStyle]?.[category] ?? {};
  return { ...base, ...override };
}

export function createSchematicSvg(features, bounds, options) {
  const paper = PAPER[options.orientation] ?? PAPER.portrait;
  const margin = options.margin ?? 12;
  const legendHeight = options.showLegend ? (options.legendMode === "both" ? 44 : 34) : 0;
  const footerHeight = options.showFooter ? 7 : 0;
  const legendPosition = options.legendPosition ?? "bottom-left";
  const topLegend = options.showLegend && legendPosition.startsWith("top") ? legendHeight : 0;
  const bottomLegend = options.showLegend && legendPosition.startsWith("bottom") ? legendHeight : 0;
  const mapBox = {
    x: margin,
    y: margin + topLegend,
    width: paper.width - margin * 2,
    height: paper.height - margin * 2 - topLegend - bottomLegend - footerHeight
  };

  const projected = projectFeatures(features, bounds, mapBox, options);
  const counts = countByCategory(projected);
  const extentText = formatExtent(bounds);
  const scale = calculateScale(bounds, mapBox);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${paper.width}mm" height="${paper.height}mm" viewBox="0 0 ${paper.width} ${paper.height}" role="img" aria-label="Tactile-style schematic map">
  <defs>
    ${patternDefs(options)}
    <clipPath id="map-clip">
      <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.width}" height="${mapBox.height}" rx="1.5" />
    </clipPath>
  </defs>
  <rect width="${paper.width}" height="${paper.height}" fill="#ffffff" />
  <rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.width}" height="${mapBox.height}" fill="#fbfaf6" stroke="#252522" stroke-width="0.45" />
  <g clip-path="url(#map-clip)">
    ${renderCategoryGroups(projected, options)}
  </g>
  ${renderMapFurniture(mapBox, scale, extentText, options, paper)}
  ${options.showLegend ? renderLegend(mapBox, paper, counts, options, legendHeight) : ""}
</svg>`;
}

export function getPaperSize(orientation) {
  return PAPER[orientation] ?? PAPER.portrait;
}

function projectFeatures(features, bounds, mapBox, options) {
  const west = mercatorX(bounds.west);
  const east = mercatorX(bounds.east);
  const south = mercatorY(bounds.south);
  const north = mercatorY(bounds.north);
  const scale = Math.min(mapBox.width / Math.max(east - west, 0.000001), mapBox.height / Math.max(north - south, 0.000001));
  const drawingWidth = (east - west) * scale;
  const drawingHeight = (north - south) * scale;
  const offsetX = mapBox.x + (mapBox.width - drawingWidth) / 2;
  const offsetY = mapBox.y + (mapBox.height - drawingHeight) / 2;
  const center = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
  const expansion = 1 + options.spacing / 170;

  const projected = features.map((feature) => {
    const points = feature.points.map((point) => {
      const raw = {
        x: offsetX + (mercatorX(point.lon) - west) * scale,
        y: offsetY + (north - mercatorY(point.lat)) * scale
      };
      return expandPoint(raw, center, expansion, mapBox);
    });

    const tolerance =
      options.simplification * 0.38 +
      (options.simplifyDenseBuildings && feature.category === "buildings" ? 0.75 : 0);
    const simplified = feature.type === "point" ? points : simplifyPoints(points, tolerance);

    return {
      ...feature,
      points: simplified,
      centroid: centroid(simplified)
    };
  });

  const offsets = computeFeatureOffsets(projected, mapBox, options.spacing, options);

  return projected.map((feature) => {
    const offset = offsets.get(feature.id) ?? { x: 0, y: 0 };
    return {
      ...feature,
      points: feature.points.map((point) => clampPoint({ x: point.x + offset.x, y: point.y + offset.y }, mapBox)),
      centroid: clampPoint({ x: feature.centroid.x + offset.x, y: feature.centroid.y + offset.y }, mapBox)
    };
  });
}

function renderCategoryGroups(features, options) {
  const labelState = [];
  return ORDER.map((category) => {
    const categoryFeatures = features.filter((feature) => feature.category === category);
    if (categoryFeatures.length === 0) {
      return "";
    }

    return `<g data-category="${category}">
      ${categoryFeatures.map((feature) => renderFeature(feature, options, labelState)).join("\n")}
    </g>`;
  }).join("\n");
}

function renderFeature(feature, options, labelState) {
  if (feature.category === "roads") {
    return renderRoad(feature, options, labelState);
  }

  if (feature.category === "transit" && feature.type !== "polygon") {
    const style = getCategoryStyle("transit", options);
    return `${renderLine(feature, options, style.stroke, Math.max(0.45, options.lineThickness * 0.7), "5 2")}
      ${renderOptionalLabel(feature, options, 0, labelState)}`;
  }

  if (feature.type === "point") {
    return `${renderPointSymbol(feature, options)}
      ${renderOptionalLabel(feature, options, 0, labelState)}`;
  }

  if (feature.type === "line") {
    const style = getCategoryStyle(feature.category, options);
    return `${renderLine(feature, options, style.stroke, Math.max(0.5, options.lineThickness), "")}
      ${renderOptionalLabel(feature, options, 0, labelState)}`;
  }

  const style = getCategoryStyle(feature.category, options);
  const path = pathFromPoints(feature.points, true);
  const isBuildingGroup = feature.category === "buildings" && feature.tags?.buildingGroup === "true";
  const strokeWidth = Math.max(0.35, options.lineThickness * (isBuildingGroup ? 0.8 : feature.emphasized ? 0.85 : 0.55));
  const groupDash = isBuildingGroup ? ' stroke-dasharray="2.6 1.3"' : "";

  return `<path d="${path}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round"${groupDash} />
    ${renderTextureAccent(feature, options)}
    ${renderOptionalLabel(feature, options, 0, labelState)}`;
}

function renderRoad(feature, options, labelState) {
  const points = feature.points;
  if (points.length < 2) {
    return "";
  }

  const roadClass = feature.tags.highway ?? "road";
  let multiplier = {
    motorway: 1.9,
    trunk: 1.7,
    primary: 1.55,
    secondary: 1.35,
    tertiary: 1.15,
    residential: 0.95,
    service: 0.72,
    footway: 0.55,
    path: 0.5
  }[roadClass] ?? 0.9;
  if (feature.isPriorityPedestrian) {
    multiplier *= 1.85;
  }

  const width = Math.max(0.45, options.lineThickness * multiplier);
  const line = pointsToPolyline(points);
  const dash = ["footway", "path", "cycleway", "steps", "pedestrian"].includes(roadClass) ? ' stroke-dasharray="2 1.3"' : "";
  const priorityHalo = feature.isPriorityPedestrian
    ? `<polyline points="${line}" fill="none" stroke="#d6c98d" stroke-width="${(width + 1.8).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`
    : "";

  return `${priorityHalo}
    <polyline points="${line}" fill="none" stroke="#ffffff" stroke-width="${(width + 1.05).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />
    <polyline points="${line}" fill="none" stroke="#272725" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dash} />
    ${renderOptionalLabel(feature, options, width, labelState)}`;
}

function renderLine(feature, options, stroke, width, dash) {
  if (feature.points.length < 2) {
    return "";
  }
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<polyline points="${pointsToPolyline(feature.points)}" fill="none" stroke="${stroke}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${dashAttr} />`;
}

function renderPointSymbol(feature, options) {
  const style = getCategoryStyle(feature.category, options);
  const point = feature.centroid;
  const radius = Math.max(2.1, options.lineThickness * (feature.emphasized ? 2.5 : 1.8) + options.spacing * 0.04);
  const stroke = Math.max(0.55, options.lineThickness * (feature.emphasized ? 0.85 : 0.55));

  if (style.symbol === "cross") {
    return `<g transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})">
      <circle r="${(radius + 0.6).toFixed(2)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${stroke.toFixed(2)}" />
      <line x1="0" y1="${(-radius * 0.72).toFixed(2)}" x2="0" y2="${(radius * 0.72).toFixed(2)}" stroke="${style.stroke}" stroke-width="${(stroke * 1.4).toFixed(2)}" stroke-linecap="round" />
      <line x1="${(-radius * 0.55).toFixed(2)}" y1="${(-radius * 0.2).toFixed(2)}" x2="${(radius * 0.55).toFixed(2)}" y2="${(-radius * 0.2).toFixed(2)}" stroke="${style.stroke}" stroke-width="${(stroke * 1.2).toFixed(2)}" stroke-linecap="round" />
    </g>`;
  }

  if (style.symbol === "plus") {
    return `<g transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})">
      <rect x="${(-radius).toFixed(2)}" y="${(-radius).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${stroke.toFixed(2)}" />
      <line x1="${(-radius * 0.55).toFixed(2)}" y1="0" x2="${(radius * 0.55).toFixed(2)}" y2="0" stroke="${style.stroke}" stroke-width="${(stroke * 1.35).toFixed(2)}" />
      <line x1="0" y1="${(-radius * 0.55).toFixed(2)}" x2="0" y2="${(radius * 0.55).toFixed(2)}" stroke="${style.stroke}" stroke-width="${(stroke * 1.35).toFixed(2)}" />
    </g>`;
  }

  if (style.symbol === "diamond") {
    const r = radius + 0.4;
    return `<polygon points="${point.x.toFixed(2)},${(point.y - r).toFixed(2)} ${(point.x + r).toFixed(2)},${point.y.toFixed(2)} ${point.x.toFixed(2)},${(point.y + r).toFixed(2)} ${(point.x - r).toFixed(2)},${point.y.toFixed(2)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${stroke.toFixed(2)}" />`;
  }

  return `<rect x="${(point.x - radius).toFixed(2)}" y="${(point.y - radius).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${stroke.toFixed(2)}" />`;
}

function renderTextureAccent(feature, options) {
  if (!["schools", "churches", "medical", "public"].includes(feature.category)) {
    return "";
  }

  const point = feature.centroid;
  const style = getCategoryStyle(feature.category, options);
  const x = point.x;
  const y = point.y;

  if (feature.category === "schools") {
    return `<rect x="${(x - 2.2).toFixed(2)}" y="${(y - 2.2).toFixed(2)}" width="4.4" height="4.4" fill="#ffffff" stroke="${style.stroke}" stroke-width="0.5" />
      <line x1="${(x - 1.3).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + 1.3).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${style.stroke}" stroke-width="0.45" />`;
  }

  if (feature.category === "churches") {
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" fill="#ffffff" stroke="${style.stroke}" stroke-width="0.5" />
      <line x1="${x.toFixed(2)}" y1="${(y - 1.6).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + 1.7).toFixed(2)}" stroke="${style.stroke}" stroke-width="0.55" />
      <line x1="${(x - 1.25).toFixed(2)}" y1="${(y - 0.55).toFixed(2)}" x2="${(x + 1.25).toFixed(2)}" y2="${(y - 0.55).toFixed(2)}" stroke="${style.stroke}" stroke-width="0.5" />`;
  }

  if (feature.category === "medical") {
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" fill="#ffffff" stroke="${style.stroke}" stroke-width="0.5" />
      <line x1="${(x - 1.35).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + 1.35).toFixed(2)}" y2="${y.toFixed(2)}" stroke="${style.stroke}" stroke-width="0.6" />
      <line x1="${x.toFixed(2)}" y1="${(y - 1.35).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + 1.35).toFixed(2)}" stroke="${style.stroke}" stroke-width="0.6" />`;
  }

  return `<polygon points="${x.toFixed(2)},${(y - 2.6).toFixed(2)} ${(x + 2.6).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${(y + 2.6).toFixed(2)} ${(x - 2.6).toFixed(2)},${y.toFixed(2)}" fill="#ffffff" stroke="${style.stroke}" stroke-width="0.5" />`;
}

function renderOptionalLabel(feature, options, lift = 0, labelState = []) {
  if (!options.showLabels || !feature.label) {
    return "";
  }
  if (options.showLandmarkLabels === false && LANDMARK_LABEL_CATEGORIES.has(feature.category)) {
    return "";
  }

  const important = ["schools", "churches", "medical", "public"].includes(feature.category) || feature.importance > 8;
  if (!important) {
    return "";
  }
  if ((options.labelDensity ?? 1) < 0.7 && !feature.emphasized && feature.importance < 11) {
    return "";
  }

  const label = truncate(escapeXml(feature.label), 32);
  const point = feature.centroid;
  const fontSize = feature.emphasized ? 3.45 : 3.1;
  const width = Math.min(Math.max(label.length * fontSize * 0.48, 12), 62);
  const height = fontSize + 1.6;
  const gap = Math.max(3.2, lift + 2.4);
  const candidates = [
    { x: point.x, y: point.y - gap, anchor: "middle", box: { x: point.x - width / 2, y: point.y - gap - height, width, height } },
    { x: point.x, y: point.y + gap + height, anchor: "middle", box: { x: point.x - width / 2, y: point.y + gap, width, height } },
    { x: point.x + gap, y: point.y + height / 2, anchor: "start", box: { x: point.x + gap, y: point.y - height / 2, width, height } },
    { x: point.x - gap, y: point.y + height / 2, anchor: "end", box: { x: point.x - gap - width, y: point.y - height / 2, width, height } }
  ];
  const padding = 1.5 * (options.collisionBoost ?? 1);
  const chosen = candidates.find((candidate) => !labelState.some((box) => boxesOverlap(inflateBox(candidate.box, padding), box))) ?? candidates[0];
  labelState.push(inflateBox(chosen.box, padding));

  return `<text x="${chosen.x.toFixed(2)}" y="${chosen.y.toFixed(2)}" text-anchor="${chosen.anchor}" font-family="Arial, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="700" fill="#111111" paint-order="stroke" stroke="#ffffff" stroke-width="1.3">${label}</text>`;
}

function renderMapFurniture(mapBox, scale, extentText, options, paper) {
  const arrowX = mapBox.x + mapBox.width - 9;
  const arrowY = mapBox.y + 12;
  const scaleWidth = Math.min(44, mapBox.width * 0.25);
  const scaleMeters = niceMeters(scaleWidth / scale.mmPerMeter);
  const actualWidth = scaleMeters * scale.mmPerMeter;
  const scaleX = mapBox.x + 8;
  const scaleY = mapBox.y + mapBox.height - 9;
  const title = escapeXml(options.title || "Tactile map schematic");
  const titleMarkup = options.showTitle
    ? `<text x="${mapBox.x}" y="${(mapBox.y - 3.2).toFixed(2)}" font-family="Arial, sans-serif" font-size="4.2" font-weight="700" fill="#111111">${title}</text>
    <text x="${mapBox.x + mapBox.width}" y="${(mapBox.y - 3.2).toFixed(2)}" text-anchor="end" font-family="Arial, sans-serif" font-size="2.7" fill="#555555">${extentText}</text>`
    : "";
  const northMarkup = options.showNorthArrow
    ? `<path d="M ${arrowX} ${arrowY - 7} L ${arrowX - 3.6} ${arrowY + 1.5} L ${arrowX} ${arrowY - 0.8} L ${arrowX + 3.6} ${arrowY + 1.5} Z" fill="#111111" />
    <text x="${arrowX}" y="${arrowY + 7.5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="3" font-weight="700" fill="#111111">N</text>`
    : "";
  const scaleMarkup = options.showScaleBar
    ? `<line x1="${scaleX}" y1="${scaleY}" x2="${(scaleX + actualWidth).toFixed(2)}" y2="${scaleY}" stroke="#111111" stroke-width="0.8" />
    <line x1="${scaleX}" y1="${scaleY - 2.2}" x2="${scaleX}" y2="${scaleY + 2.2}" stroke="#111111" stroke-width="0.8" />
    <line x1="${(scaleX + actualWidth).toFixed(2)}" y1="${scaleY - 2.2}" x2="${(scaleX + actualWidth).toFixed(2)}" y2="${scaleY + 2.2}" stroke="#111111" stroke-width="0.8" />
    <text x="${scaleX}" y="${scaleY - 3.2}" font-family="Arial, sans-serif" font-size="2.8" font-weight="700" fill="#111111">${scaleMeters} m</text>`
    : "";
  const footerMarkup = options.showFooter
    ? `<text x="${paper.width / 2}" y="${(paper.height - 3.5).toFixed(2)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2.6" fill="#555555">Bouronikos Christos · chrisbouronikos@gmail.com · github.com/ChristosBouronikos</text>`
    : "";

  return `<g aria-hidden="true">
    ${titleMarkup}
    ${northMarkup}
    ${scaleMarkup}
    ${footerMarkup}
  </g>`;
}

function renderLegend(mapBox, paper, counts, options, legendHeight) {
  const margin = options.margin ?? 12;
  const position = options.legendPosition ?? "bottom-left";
  const entries = ORDER.filter((category) => counts[category] > 0 && FEATURE_TYPES[category]);
  const compactEntries = entries.length > 0 ? entries : ["roads", "buildings", "parks", "churches", "schools", "water"];
  const rowHeight = options.legendMode === "both" ? 8.2 : 6.4;
  const columns = paper.width > 230 ? 3 : 2;
  const legendWidth = Math.min(paper.width - margin * 2, columns * 64);
  const columnWidth = legendWidth / columns;
  const x = position.endsWith("right") ? paper.width - margin - legendWidth : margin;
  const y = position.startsWith("top") ? margin + 4 : mapBox.y + mapBox.height + 8;

  const rows = compactEntries.map((category, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const itemX = x + col * columnWidth;
    const itemY = y + 7 + row * rowHeight;
    return renderLegendItem(category, itemX, itemY, options);
  }).join("\n");

  return `<g aria-label="Legend">
    <text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="3.8" font-weight="700" fill="#111111">Υπόμνημα</text>
    ${rows}
  </g>`;
}

function renderLegendItem(category, x, y, options) {
  const style = getCategoryStyle(category, options);
  const greek = FEATURE_TYPES[category].greek;
  const label = options.legendMode === "braille" ? toGreekBraille(greek) : greek;
  const text = escapeXml(label);
  const braille = escapeXml(toGreekBraille(greek));

  let swatch = "";
  if (category === "roads") {
    swatch = `<line x1="${x}" y1="${y - 1.7}" x2="${x + 8}" y2="${y - 1.7}" stroke="#111111" stroke-width="1.6" stroke-linecap="round" />`;
  } else if (category === "water" || category === "parks" || category === "buildings" || category === "schools") {
    swatch = `<rect x="${x}" y="${y - 4.7}" width="7.2" height="5.8" fill="${style.fill}" stroke="${style.stroke}" stroke-width="0.45" />`;
  } else if (category === "churches") {
    swatch = `<circle cx="${x + 3.7}" cy="${y - 2}" r="3" fill="${style.fill}" stroke="${style.stroke}" stroke-width="0.45" />
      <line x1="${x + 3.7}" y1="${y - 4}" x2="${x + 3.7}" y2="${y}" stroke="${style.stroke}" stroke-width="0.65" />
      <line x1="${x + 2.2}" y1="${y - 2.9}" x2="${x + 5.2}" y2="${y - 2.9}" stroke="${style.stroke}" stroke-width="0.55" />`;
  } else {
    swatch = `<circle cx="${x + 3.6}" cy="${y - 2}" r="3" fill="${style.fill}" stroke="${style.stroke}" stroke-width="0.45" />`;
  }

  if (options.legendMode === "both") {
    return `<g>
      ${swatch}
      <text x="${x + 10}" y="${y - 2.2}" font-family="Arial, sans-serif" font-size="2.9" font-weight="700" fill="#111111">${escapeXml(greek)}</text>
      <text x="${x + 10}" y="${y + 2.2}" font-family="Arial, sans-serif" font-size="3.1" fill="#111111">${braille}</text>
    </g>`;
  }

  return `<g>
    ${swatch}
    <text x="${x + 10}" y="${y - 1.1}" font-family="Arial, sans-serif" font-size="${options.legendMode === "braille" ? "3.5" : "3.1"}" font-weight="700" fill="#111111">${text}</text>
  </g>`;
}

function patternDefs(options = {}) {
  const palette = patternPalette(options.presetStyle);
  return `<pattern id="buildingPattern" patternUnits="userSpaceOnUse" width="4" height="4">
      <rect width="4" height="4" fill="${palette.buildingFill}" />
      <path d="M -1 4 L 4 -1 M 1 5 L 5 1" stroke="${palette.buildingStroke}" stroke-width="${palette.thin}" />
    </pattern>
    <pattern id="parkPattern" patternUnits="userSpaceOnUse" width="5" height="5">
      <rect width="5" height="5" fill="${palette.parkFill}" />
      <circle cx="1.3" cy="1.2" r="${palette.dot}" fill="${palette.parkStroke}" />
      <circle cx="3.7" cy="3.4" r="${palette.dot}" fill="${palette.parkStroke}" />
    </pattern>
    <pattern id="waterPattern" patternUnits="userSpaceOnUse" width="6" height="5">
      <rect width="6" height="5" fill="${palette.waterFill}" />
      <path d="M 0 2 C 1.5 0.8 3 3.2 4.5 2 C 5 1.6 5.5 1.6 6 2" fill="none" stroke="${palette.waterStroke}" stroke-width="${palette.medium}" />
    </pattern>
    <pattern id="schoolPattern" patternUnits="userSpaceOnUse" width="5" height="5">
      <rect width="5" height="5" fill="${palette.schoolFill}" />
      <path d="M 0 0 L 5 5 M 5 0 L 0 5" stroke="${palette.schoolStroke}" stroke-width="${palette.thin}" />
    </pattern>
    <pattern id="churchPattern" patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill="${palette.churchFill}" />
      <path d="M 3 0.8 L 3 5.2 M 1.5 2.4 L 4.5 2.4" stroke="${palette.churchStroke}" stroke-width="${palette.medium}" />
    </pattern>
    <pattern id="medicalPattern" patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill="${palette.medicalFill}" />
      <path d="M 3 1.1 L 3 4.9 M 1.1 3 L 4.9 3" stroke="${palette.medicalStroke}" stroke-width="${palette.heavy}" />
    </pattern>
    <pattern id="publicPattern" patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill="${palette.publicFill}" />
      <path d="M 3 0.8 L 5.2 3 L 3 5.2 L 0.8 3 Z" fill="none" stroke="${palette.publicStroke}" stroke-width="${palette.medium}" />
    </pattern>
    <pattern id="transitPattern" patternUnits="userSpaceOnUse" width="6" height="6">
      <rect width="6" height="6" fill="${palette.transitFill}" />
      <path d="M 0 1.6 L 6 1.6 M 0 4.4 L 6 4.4" stroke="${palette.transitStroke}" stroke-width="${palette.thin}" />
    </pattern>`;
}

function patternPalette(style = "plain") {
  if (style === "highContrast") {
    return {
      buildingFill: "#ffffff",
      buildingStroke: "#111111",
      parkFill: "#dce8d4",
      parkStroke: "#3d5637",
      waterFill: "#d7e3ea",
      waterStroke: "#23495f",
      schoolFill: "#e8dcc0",
      schoolStroke: "#6b5b37",
      churchFill: "#e7d9ce",
      churchStroke: "#5f493d",
      medicalFill: "#ead9d6",
      medicalStroke: "#6b4a46",
      publicFill: "#e2e1de",
      publicStroke: "#53545a",
      transitFill: "#e4e5e3",
      transitStroke: "#34383a",
      thin: 0.36,
      medium: 0.46,
      heavy: 0.58,
      dot: 0.58
    };
  }

  if (style === "embosser" || style === "laser") {
    return {
      buildingFill: "#ffffff",
      buildingStroke: "#333333",
      parkFill: "#ffffff",
      parkStroke: "#222222",
      waterFill: "#ffffff",
      waterStroke: "#111111",
      schoolFill: "#ffffff",
      schoolStroke: "#111111",
      churchFill: "#ffffff",
      churchStroke: "#111111",
      medicalFill: "#ffffff",
      medicalStroke: "#111111",
      publicFill: "#ffffff",
      publicStroke: "#111111",
      transitFill: "#ffffff",
      transitStroke: "#111111",
      thin: style === "laser" ? 0.24 : 0.42,
      medium: style === "laser" ? 0.28 : 0.52,
      heavy: style === "laser" ? 0.36 : 0.68,
      dot: style === "laser" ? 0.35 : 0.62
    };
  }

  if (style === "swell") {
    return {
      buildingFill: "#eeece6",
      buildingStroke: "#45433f",
      parkFill: "#dde5d4",
      parkStroke: "#55614a",
      waterFill: "#dbe4e8",
      waterStroke: "#536979",
      schoolFill: "#e7dcc1",
      schoolStroke: "#746444",
      churchFill: "#e5d8ce",
      churchStroke: "#675447",
      medicalFill: "#eadbd8",
      medicalStroke: "#755b56",
      publicFill: "#e2e0dd",
      publicStroke: "#626167",
      transitFill: "#e1e3e2",
      transitStroke: "#52585b",
      thin: 0.38,
      medium: 0.48,
      heavy: 0.6,
      dot: 0.6
    };
  }

  return {
    buildingFill: "#efede7",
    buildingStroke: "#6a6862",
    parkFill: "#e2e7dc",
    parkStroke: "#6f7a61",
    waterFill: "#dfe7eb",
    waterStroke: "#5d7180",
    schoolFill: "#e9dfc5",
    schoolStroke: "#8b7854",
    churchFill: "#e7ded6",
    churchStroke: "#7a6657",
    medicalFill: "#eadeda",
    medicalStroke: "#8b6b64",
    publicFill: "#e3e2dd",
    publicStroke: "#6f6b73",
    transitFill: "#e4e5e3",
    transitStroke: "#6d7376",
    thin: 0.3,
    medium: 0.36,
    heavy: 0.44,
    dot: 0.5
  };
}

function computeFeatureOffsets(features, mapBox, spacing, options = {}) {
  const offsets = new Map(features.map((feature) => [feature.id, { x: 0, y: 0 }]));
  if (spacing <= 1 || features.length > 1800) {
    return offsets;
  }

  const boost = options.collisionBoost ?? 1;
  const lineThickness = options.lineThickness ?? 1;
  const movableAnchors = features
    .filter((feature) => feature.category !== "roads" && feature.points.length > 0)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 900)
    .map((feature) => ({
      id: feature.id,
      category: feature.category,
      x: feature.centroid.x,
      y: feature.centroid.y,
      weight: collisionWeight(feature)
    }));
  const roadFeatures = features
    .filter((feature) => feature.category === "roads" && feature.points.length > 1)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 520);

  const minDistance = Math.max(2.8, spacing * 0.42 * boost + lineThickness * 0.45);
  const roadClearance = Math.max(2.8, spacing * 0.2 * boost + lineThickness * 1.6);
  const maxMove = spacing * 0.78 * boost + lineThickness * 1.6;
  const iterations = boost > 1.2 ? 7 : 5;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let i = 0; i < movableAnchors.length; i += 1) {
      for (let j = i + 1; j < movableAnchors.length; j += 1) {
        const a = movableAnchors[i];
        const b = movableAnchors[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const target = minDistance * ((a.weight + b.weight) / 2);
        if (dist >= target) {
          continue;
        }

        const push = (target - dist) * 0.36;
        const ux = dx / dist;
        const uy = dy / dist;
        const aOffset = offsets.get(a.id);
        const bOffset = offsets.get(b.id);
        aOffset.x -= ux * push;
        aOffset.y -= uy * push;
        bOffset.x += ux * push;
        bOffset.y += uy * push;
        clampOffset(aOffset, maxMove);
        clampOffset(bOffset, maxMove);
        a.x = clamp(a.x + aOffset.x * 0.15, mapBox.x, mapBox.x + mapBox.width);
        a.y = clamp(a.y + aOffset.y * 0.15, mapBox.y, mapBox.y + mapBox.height);
        b.x = clamp(b.x + bOffset.x * 0.15, mapBox.x, mapBox.x + mapBox.width);
        b.y = clamp(b.y + bOffset.y * 0.15, mapBox.y, mapBox.y + mapBox.height);
      }
    }

    if (roadFeatures.length > 0) {
      for (const anchor of movableAnchors) {
        if (!needsRoadClearance(anchor.category)) {
          continue;
        }

        const nearest = nearestRoadVector(anchor, roadFeatures, mapBox);
        const target = roadClearance * roadClearanceWeight(anchor.category);
        if (nearest.distance >= target) {
          continue;
        }

        const push = (target - nearest.distance) * 0.58;
        const offset = offsets.get(anchor.id);
        offset.x += nearest.ux * push;
        offset.y += nearest.uy * push;
        clampOffset(offset, maxMove);
        anchor.x = clamp(anchor.x + nearest.ux * push * 0.22, mapBox.x, mapBox.x + mapBox.width);
        anchor.y = clamp(anchor.y + nearest.uy * push * 0.22, mapBox.y, mapBox.y + mapBox.height);
      }
    }
  }

  return offsets;
}

function needsRoadClearance(category) {
  return ["buildings", "schools", "churches", "medical", "public", "transit"].includes(category);
}

function roadClearanceWeight(category) {
  if (["schools", "churches", "medical", "public"].includes(category)) {
    return 1.35;
  }
  if (category === "transit") {
    return 1.15;
  }
  return 1;
}

function nearestRoadVector(anchor, roadFeatures, mapBox) {
  let best = { distance: Infinity, ux: 1, uy: 0 };

  for (const road of roadFeatures) {
    for (let index = 0; index < road.points.length - 1; index += 1) {
      const start = road.points[index];
      const end = road.points[index + 1];
      const nearest = nearestPointOnSegment(anchor, start, end);
      const dx = anchor.x - nearest.x;
      const dy = anchor.y - nearest.y;
      const distance = Math.hypot(dx, dy);
      if (distance < best.distance) {
        if (distance < 0.001) {
          const fallbackX = anchor.x - (mapBox.x + mapBox.width / 2);
          const fallbackY = anchor.y - (mapBox.y + mapBox.height / 2);
          const fallbackLength = Math.hypot(fallbackX, fallbackY) || 1;
          best = { distance, ux: fallbackX / fallbackLength, uy: fallbackY / fallbackLength };
        } else {
          best = { distance, ux: dx / distance, uy: dy / distance };
        }
      }
    }
  }

  return best;
}

function nearestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) {
    return start;
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return {
    x: start.x + dx * t,
    y: start.y + dy * t
  };
}

function collisionWeight(feature) {
  if (feature.emphasized) {
    return 2.1;
  }
  if (feature.isPriorityPedestrian) {
    return 1.55;
  }
  if (["schools", "churches", "medical", "public"].includes(feature.category)) {
    return 1.7;
  }
  if (feature.category === "buildings") {
    return 0.92;
  }
  if (feature.category === "parks" || feature.category === "water") {
    return 1.25;
  }
  return 1;
}

function expandPoint(point, center, expansion, mapBox) {
  return clampPoint(
    {
      x: center.x + (point.x - center.x) * expansion,
      y: center.y + (point.y - center.y) * expansion
    },
    mapBox
  );
}

function clampPoint(point, box) {
  return {
    x: clamp(point.x, box.x, box.x + box.width),
    y: clamp(point.y, box.y, box.y + box.height)
  };
}

function clampOffset(offset, maxMove) {
  const length = Math.hypot(offset.x, offset.y);
  if (length > maxMove && length > 0) {
    offset.x = (offset.x / length) * maxMove;
    offset.y = (offset.y / length) * maxMove;
  }
}

function simplifyPoints(points, tolerance) {
  if (points.length <= 3 || tolerance <= 0.05) {
    return points;
  }

  const simplified = douglasPeucker(points, tolerance);
  return simplified.length >= 2 ? simplified : points;
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, index + 1), tolerance);
    const right = douglasPeucker(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / Math.hypot(dx, dy);
}

function centroid(points) {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function pathFromPoints(points, close = false) {
  if (points.length === 0) {
    return "";
  }

  const commands = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  return `${commands.join(" ")}${close ? " Z" : ""}`;
}

function pointsToPolyline(points) {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

function mercatorX(lon) {
  return lon;
}

function mercatorY(lat) {
  const radians = (lat * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + radians / 2)) * 180) / Math.PI;
}

function countByCategory(features) {
  return features.reduce((acc, feature) => {
    acc[feature.category] = (acc[feature.category] ?? 0) + 1;
    return acc;
  }, {});
}

function calculateScale(bounds, mapBox) {
  const centerLat = (bounds.north + bounds.south) / 2;
  const widthMeters = distanceMeters(centerLat, bounds.west, centerLat, bounds.east);
  return { mmPerMeter: mapBox.width / Math.max(widthMeters, 1) };
}

function niceMeters(value) {
  const steps = [10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000];
  return steps.find((step) => step >= value * 0.72) ?? 2000;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const radius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatExtent(bounds) {
  const width = distanceMeters((bounds.north + bounds.south) / 2, bounds.west, (bounds.north + bounds.south) / 2, bounds.east);
  const height = distanceMeters(bounds.south, (bounds.west + bounds.east) / 2, bounds.north, (bounds.west + bounds.east) / 2);
  return `${Math.round(width)} m × ${Math.round(height)} m`;
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function inflateBox(box, padding) {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
