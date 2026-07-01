import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  AlertTriangle,
  Download,
  Eye,
  FileCog,
  FileDown,
  Github,
  HeartHandshake,
  ImageDown,
  Landmark,
  Layers,
  ListChecks,
  Loader2,
  Mail,
  Map as MapIcon,
  MapPinned,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  X
} from "lucide-react";
import { FEATURE_TYPES, fetchOsmFeatures } from "./lib/overpass";
import { createSchematicSvg } from "./lib/schematic";
import { downloadPdf, downloadPng, downloadTextFile } from "./lib/exporters";

const APP_NAME = "Haptic Map Schematic, by Bouronikos Christos";
const AUTHOR_CONTACT = {
  email: "chrisbouronikos@gmail.com",
  paypal: "https://paypal.me/christosbouronikos",
  github: "https://github.com/ChristosBouronikos"
};

const LARISSA = [39.639, 22.4191];
const LANDMARK_CATEGORIES = ["schools", "churches", "parks", "medical", "public"];
const MINOR_ROADS = new Set(["residential", "service", "unclassified", "living_street", "track", "footway", "path", "cycleway", "steps"]);
const PEDESTRIAN_ROADS = new Set(["footway", "path", "pedestrian", "steps", "cycleway", "living_street"]);

const DEFAULT_CATEGORIES = {
  roads: true,
  buildings: true,
  parks: true,
  churches: true,
  schools: true,
  water: true,
  transit: true,
  medical: true,
  public: true
};

const PRESETS = {
  plain: {
    values: {
      spacing: 16,
      simplification: 3,
      lineThickness: 1.1,
      groupCloseBuildings: false,
      buildingGroupDistance: 12,
      showLabels: true,
      showLandmarkLabels: true,
      showLegend: true,
      legendMode: "both",
      presetStyle: "plain"
    }
  },
  lowVision: {
    values: {
      spacing: 18,
      simplification: 3,
      lineThickness: 1.7,
      groupCloseBuildings: true,
      buildingGroupDistance: 14,
      showLabels: true,
      showLandmarkLabels: true,
      showLegend: true,
      legendMode: "greek",
      presetStyle: "highContrast"
    }
  },
  swell: {
    values: {
      spacing: 24,
      simplification: 4,
      lineThickness: 1.45,
      groupCloseBuildings: true,
      buildingGroupDistance: 18,
      showLabels: true,
      showLandmarkLabels: true,
      showLegend: true,
      legendMode: "both",
      presetStyle: "swell"
    }
  },
  embosser: {
    values: {
      spacing: 28,
      simplification: 5,
      lineThickness: 1.85,
      groupCloseBuildings: true,
      buildingGroupDistance: 22,
      showLabels: false,
      showLandmarkLabels: false,
      showLegend: true,
      legendMode: "braille",
      presetStyle: "embosser"
    }
  },
  laser: {
    values: {
      spacing: 22,
      simplification: 5,
      lineThickness: 0.8,
      groupCloseBuildings: true,
      buildingGroupDistance: 16,
      showLabels: false,
      showLandmarkLabels: false,
      showLegend: false,
      legendMode: "greek",
      presetStyle: "laser"
    }
  }
};

const QUALITY_MODES = {
  fast: {
    simplificationDelta: 2,
    labelDensity: 0.55,
    collisionBoost: 0.9,
    caps: { roads: 320, buildings: 240, parks: 60, churches: 70, schools: 70, water: 80, transit: 60, medical: 60, public: 60 }
  },
  detailed: {
    simplificationDelta: 0,
    labelDensity: 0.85,
    collisionBoost: 1.15,
    caps: { roads: 700, buildings: 650, parks: 160, churches: 120, schools: 120, water: 160, transit: 120, medical: 100, public: 100 }
  },
  export: {
    simplificationDelta: -1,
    labelDensity: 1,
    collisionBoost: 1.4,
    caps: { roads: 1000, buildings: 1100, parks: 260, churches: 160, schools: 160, water: 240, transit: 180, medical: 130, public: 130 }
  }
};

const AREA_GUIDE = [
  { max: 260, label: { en: "building-level detail", el: "λεπτομέρεια κτιρίων" } },
  { max: 520, label: { en: "block detail", el: "λεπτομέρεια τετραγώνου" } },
  { max: 950, label: { en: "neighborhood detail", el: "λεπτομέρεια γειτονιάς" } },
  { max: 1400, label: { en: "district overview", el: "επισκόπηση περιοχής" } },
  { max: Infinity, label: { en: "city slice, simplified", el: "τμήμα πόλης, απλοποιημένο" } }
];

const TEXT = {
  en: {
    appSubtitle: "OpenStreetMap area to A4 tactile-style diagram",
    area: "Area",
    selectionCoverage: "Selection coverage",
    selectedFootprint: "Selected footprint",
    portrait: "Portrait",
    landscape: "Landscape",
    features: "Features",
    schematic: "Schematic",
    spacing: "Spacing between elements",
    schematicSeparation: "schematic separation",
    simplification: "Simplification level",
    detailed: "detailed",
    balanced: "balanced",
    abstract: "abstract",
    lineThickness: "Line thickness",
    strokeBase: "stroke base",
    mapTitle: "Map title",
    labels: "Labels",
    legend: "Legend",
    legendLanguage: "Legend language",
    greekBrailleBoth: "Greek text and Greek Braille",
    greekOnly: "Greek text only",
    brailleOnly: "Greek Braille only",
    generate: "Generate schematic",
    retry: "Retry",
    contactDeveloper: "Contact Developer",
    developerCredit: "Project made by Bouronikos Christos",
    developerContactIntro: "For feedback, improvements, or collaboration, contact the developer.",
    supportDevelopment: "Support development",
    supportDevelopmentLong: "If this project helped you, consider supporting future development with a PayPal donation.",
    donatePaypal: "Donate with PayPal",
    close: "Close",
    mapSelection: "Map Selection",
    previewTitle: "A4 Schematic Preview",
    larissa: "Larissa, Greece",
    generateToPreview: "Generate to preview",
    map: "Map",
    preview: "Preview",
    presets: "Tactile presets",
    plainPreset: "Plain paper preview",
    lowVisionPreset: "Low vision high contrast",
    swellPreset: "Swell paper",
    embosserPreset: "Embosser",
    laserPreset: "Laser cut",
    importance: "Feature importance",
    emphasizeLandmarks: "Emphasize schools/churches/hospitals",
    hideMinorRoads: "Hide minor roads",
    showOnlyLandmarks: "Show only landmarks",
    simplifyDenseBuildings: "Simplify dense buildings",
    groupCloseBuildings: "Group close buildings",
    buildingGroupDistance: "Building group distance",
    buildingGroupDistanceHint: "merge gap",
    prioritizePedestrian: "Prioritize pedestrian routes",
    qualityMode: "Preview quality",
    fastPreview: "Fast preview",
    detailedPreview: "Detailed preview",
    exportQuality: "Export quality",
    language: "UI language",
    english: "English",
    greek: "Greek",
    fetchingRoads: "Fetching roads and paths",
    fetchingBuildings: "Fetching buildings",
    fetchingLandmarks: "Fetching landmarks",
    overpassSlow: "Overpass is slow. Still trying mirrors.",
    retryingLight: "Full request failed. Retrying a lighter map without buildings.",
    simplifyingMap: "Simplifying map",
    generatingExport: "Generating export",
    ready: "Ready",
    dataSource: "Data source",
    osmFeatures: "OSM features",
    rendered: "rendered",
    hiddenByLimits: "hidden by limits",
    offlineTitle: "Could not fetch map data",
    offlineHelp: "Check the connection, retry, reduce the area, or disable buildings for a lighter request.",
    exportSettings: "Export settings",
    marginSize: "Margin size",
    scaleBar: "Scale bar",
    northArrow: "North arrow",
    landmarkLabels: "Landmark labels",
    legendPosition: "Legend position",
    bottomLeft: "Bottom left",
    bottomRight: "Bottom right",
    topLeft: "Top left",
    topRight: "Top right",
    titleFooter: "Title/footer",
    title: "Title",
    footer: "Footer",
    downloadSvg: "Download SVG",
    downloadPng: "Download PNG",
    downloadPdf: "Download A4 PDF",
    landmarkSummary: "Landmark summary",
    include: "Include",
    detected: "detected",
    noLandmarks: "Generate a schematic to review detected landmarks.",
    emptyPreview: "Generate the schematic first, then switch between this preview and the map.",
    noFeatures: "No matching map features were found for the selected area and filters."
  },
  el: {
    appSubtitle: "Περιοχή OpenStreetMap σε απτικό διάγραμμα A4",
    area: "Περιοχή",
    selectionCoverage: "Κάλυψη επιλογής",
    selectedFootprint: "Επιλεγμένη έκταση",
    portrait: "Κατακόρυφο",
    landscape: "Οριζόντιο",
    features: "Στοιχεία",
    schematic: "Σχέδιο",
    spacing: "Απόσταση στοιχείων",
    schematicSeparation: "απόσταση σχεδίου",
    simplification: "Επίπεδο απλοποίησης",
    detailed: "λεπτομερές",
    balanced: "ισορροπημένο",
    abstract: "αφαιρετικό",
    lineThickness: "Πάχος γραμμής",
    strokeBase: "βασική γραμμή",
    mapTitle: "Τίτλος χάρτη",
    labels: "Ετικέτες",
    legend: "Υπόμνημα",
    legendLanguage: "Γλώσσα υπομνήματος",
    greekBrailleBoth: "Ελληνικά και ελληνικό Braille",
    greekOnly: "Μόνο ελληνικά",
    brailleOnly: "Μόνο ελληνικό Braille",
    generate: "Δημιουργία σχεδίου",
    retry: "Επανάληψη",
    contactDeveloper: "Επικοινωνία με τον developer",
    developerCredit: "Το project δημιουργήθηκε από τον Bouronikos Christos",
    developerContactIntro: "Για σχόλια, βελτιώσεις ή συνεργασία, επικοινωνήστε με τον developer.",
    supportDevelopment: "Υποστήριξη ανάπτυξης",
    supportDevelopmentLong: "Αν το project σας βοήθησε, μπορείτε να στηρίξετε τη συνέχεια της ανάπτυξης με δωρεά στο PayPal.",
    donatePaypal: "Δωρεά μέσω PayPal",
    close: "Κλείσιμο",
    mapSelection: "Επιλογή χάρτη",
    previewTitle: "Προεπισκόπηση A4",
    larissa: "Λάρισα, Ελλάδα",
    generateToPreview: "Δημιουργία για προεπισκόπηση",
    map: "Χάρτης",
    preview: "Προεπισκόπηση",
    presets: "Απτικές ρυθμίσεις",
    plainPreset: "Προεπισκόπηση σε χαρτί",
    lowVisionPreset: "Υψηλή αντίθεση",
    swellPreset: "Swell paper",
    embosserPreset: "Embosser",
    laserPreset: "Laser cut",
    importance: "Σημαντικότητα στοιχείων",
    emphasizeLandmarks: "Έμφαση σε σχολεία/εκκλησίες/νοσοκομεία",
    hideMinorRoads: "Απόκρυψη μικρών δρόμων",
    showOnlyLandmarks: "Μόνο σημεία αναφοράς",
    simplifyDenseBuildings: "Απλοποίηση πυκνών κτιρίων",
    groupCloseBuildings: "Ομαδοποίηση κοντινών κτιρίων",
    buildingGroupDistance: "Απόσταση ομαδοποίησης κτιρίων",
    buildingGroupDistanceHint: "κενό συγχώνευσης",
    prioritizePedestrian: "Προτεραιότητα πεζών διαδρομών",
    qualityMode: "Ποιότητα προεπισκόπησης",
    fastPreview: "Γρήγορη",
    detailedPreview: "Λεπτομερής",
    exportQuality: "Ποιότητα εξαγωγής",
    language: "Γλώσσα UI",
    english: "Αγγλικά",
    greek: "Ελληνικά",
    fetchingRoads: "Λήψη δρόμων και μονοπατιών",
    fetchingBuildings: "Λήψη κτιρίων",
    fetchingLandmarks: "Λήψη σημείων αναφοράς",
    overpassSlow: "Το Overpass αργεί. Δοκιμάζονται εναλλακτικοί servers.",
    retryingLight: "Το πλήρες αίτημα απέτυχε. Δοκιμή ελαφρύτερου χάρτη χωρίς κτίρια.",
    simplifyingMap: "Απλοποίηση χάρτη",
    generatingExport: "Δημιουργία εξαγωγής",
    ready: "Έτοιμο",
    dataSource: "Πηγή δεδομένων",
    osmFeatures: "Στοιχεία OSM",
    rendered: "αποδόθηκαν",
    hiddenByLimits: "κρυμμένα λόγω ορίων",
    offlineTitle: "Δεν έγινε λήψη δεδομένων χάρτη",
    offlineHelp: "Ελέγξτε τη σύνδεση, δοκιμάστε ξανά, μειώστε την περιοχή ή απενεργοποιήστε τα κτίρια.",
    exportSettings: "Ρυθμίσεις εξαγωγής",
    marginSize: "Περιθώριο",
    scaleBar: "Κλίμακα",
    northArrow: "Βόρειο βέλος",
    landmarkLabels: "Ετικέτες σημείων αναφοράς",
    legendPosition: "Θέση υπομνήματος",
    bottomLeft: "Κάτω αριστερά",
    bottomRight: "Κάτω δεξιά",
    topLeft: "Πάνω αριστερά",
    topRight: "Πάνω δεξιά",
    titleFooter: "Τίτλος/footer",
    title: "Τίτλος",
    footer: "Footer",
    downloadSvg: "Λήψη SVG",
    downloadPng: "Λήψη PNG",
    downloadPdf: "Λήψη A4 PDF",
    landmarkSummary: "Σημεία αναφοράς",
    include: "Συμπερίληψη",
    detected: "εντοπίστηκαν",
    noLandmarks: "Δημιουργήστε σχέδιο για έλεγχο σημείων αναφοράς.",
    emptyPreview: "Δημιουργήστε πρώτα το σχέδιο και μετά δείτε την προεπισκόπηση.",
    noFeatures: "Δεν βρέθηκαν στοιχεία χάρτη για την επιλεγμένη περιοχή και τα φίλτρα."
  }
};

const DEFAULT_OPTIONS = {
  coverageMeters: 650,
  orientation: "portrait",
  spacing: 16,
  simplification: 3,
  lineThickness: 1.1,
  showLabels: true,
  showLandmarkLabels: true,
  showLegend: true,
  legendMode: "both",
  legendPosition: "bottom-left",
  title: APP_NAME,
  tactilePreset: "plain",
  presetStyle: "plain",
  qualityMode: "detailed",
  uiLanguage: "en",
  emphasizeLandmarks: true,
  hideMinorRoads: false,
  showOnlyLandmarks: false,
  simplifyDenseBuildings: false,
  groupCloseBuildings: false,
  buildingGroupDistance: 12,
  prioritizePedestrianRoutes: false,
  margin: 12,
  showScaleBar: true,
  showNorthArrow: true,
  showTitle: true,
  showFooter: true
};

export default function App() {
  const mapNode = useRef(null);
  const leafletMap = useRef(null);
  const selectionLayer = useRef(null);
  const [mapCenter, setMapCenter] = useState({ lat: LARISSA[0], lng: LARISSA[1] });
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [features, setFeatures] = useState([]);
  const [excludedLandmarks, setExcludedLandmarks] = useState({});
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("idle");
  const [progressMessage, setProgressMessage] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [supportPromptOpen, setSupportPromptOpen] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("map");

  const t = TEXT[options.uiLanguage];
  const selectedCategories = useMemo(
    () => Object.keys(categories).filter((category) => categories[category]),
    [categories]
  );
  const bounds = useMemo(
    () => boundsFromCenter(mapCenter, options.coverageMeters, options.orientation, options.showLegend, options.legendPosition),
    [mapCenter, options.coverageMeters, options.orientation, options.showLegend, options.legendPosition]
  );
  const renderOptions = useMemo(() => buildRenderOptions(options), [options]);
  const renderFeatures = useMemo(
    () => prepareRenderFeatures(features, options, excludedLandmarks, bounds),
    [features, options, excludedLandmarks, bounds]
  );
  const landmarks = useMemo(() => buildLandmarkSummary(features), [features]);
  const schematicSvg = useMemo(() => {
    if (features.length === 0) {
      return "";
    }
    return createSchematicSvg(renderFeatures, bounds, renderOptions);
  }, [features.length, renderFeatures, bounds, renderOptions]);

  useEffect(() => {
    if (!mapNode.current || leafletMap.current) {
      return;
    }

    const map = L.map(mapNode.current, {
      center: LARISSA,
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    const rectangle = L.rectangle(leafletBounds(bounds), {
      color: "#171717",
      fillColor: "#171717",
      fillOpacity: 0.08,
      weight: 2,
      dashArray: "8 5"
    }).addTo(map);

    selectionLayer.current = rectangle;
    leafletMap.current = map;

    const updateCenter = () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
    };

    map.on("moveend", updateCenter);
    map.on("click", (event) => {
      map.panTo(event.latlng);
    });

    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      leafletMap.current = null;
      selectionLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (selectionLayer.current) {
      selectionLayer.current.setBounds(leafletBounds(bounds));
    }
  }, [bounds]);

  useEffect(() => {
    if (activeView === "map" && leafletMap.current) {
      setTimeout(() => leafletMap.current?.invalidateSize(), 80);
    }
  }, [activeView]);

  const generate = useCallback(async () => {
    if (selectedCategories.length === 0) {
      setError("Select at least one feature category.");
      return;
    }

    setStatus("loading");
    setError("");
    setActiveView("map");
    setProgressMessage(t.fetchingRoads);
    const timers = [
      window.setTimeout(() => setProgressMessage(t.fetchingBuildings), 1000),
      window.setTimeout(() => setProgressMessage(t.fetchingLandmarks), 2200),
      window.setTimeout(() => setProgressMessage(t.overpassSlow), 10000)
    ];

    try {
      const result = await fetchWithFallback(bounds, selectedCategories, setProgressMessage, t);
      setProgressMessage(t.simplifyingMap);
      await waitForUi();
      setFeatures(result.features);
      setExcludedLandmarks({});
      setMeta(result.meta);
      setStatus("ready");
      setProgressMessage(t.ready);
      if (result.features.length > 0) {
        setActiveView("preview");
      } else {
        setError(t.noFeatures);
        setActiveView("map");
      }
    } catch (fetchError) {
      setStatus("error");
      setProgressMessage("");
      setError(formatFetchError(fetchError, t));
      setActiveView("map");
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
    }
  }, [bounds, selectedCategories, t]);

  const updateOption = (key, value) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    setOptions((current) => ({ ...current, tactilePreset: presetKey, ...preset.values }));
  };

  const toggleCategory = (category) => {
    setCategories((current) => ({ ...current, [category]: !current[category] }));
  };

  const toggleLandmark = (key) => {
    setExcludedLandmarks((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const handleDownload = async (type) => {
    if (!schematicSvg) {
      return;
    }

    setExportStatus(t.generatingExport);
    try {
      if (type === "svg") {
        downloadTextFile(schematicSvg, "haptic-map-schematic.svg", "image/svg+xml;charset=utf-8");
      }
      if (type === "png") {
        await downloadPng(schematicSvg, options.orientation);
      }
      if (type === "pdf") {
        await downloadPdf(schematicSvg, options.orientation);
      }
      setSupportPromptOpen(true);
    } finally {
      window.setTimeout(() => setExportStatus(""), 800);
    }
  };

  const areaLabel = AREA_GUIDE.find((guide) => options.coverageMeters <= guide.max)?.label[options.uiLanguage];
  const extent = formatBoundsSize(bounds);
  const isLoading = status === "loading";

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="control-panel" aria-label="Map and schematic controls">
          <div className="brand-block">
            <div className="brand-mark">
              <MapPinned size={22} aria-hidden="true" />
            </div>
            <div className="brand-content">
              <div className="brand-title-row">
                <h1>{APP_NAME}</h1>
                <LanguageToggle language={options.uiLanguage} onChange={(value) => updateOption("uiLanguage", value)} />
              </div>
              <p>{t.appSubtitle}</p>
            </div>
          </div>

          <div className="action-stack top-action-stack">
            <button type="button" className="primary-action" onClick={generate} disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <RefreshCcw size={18} aria-hidden="true" />}
              {isLoading ? progressMessage || t.generate : t.generate}
            </button>
          </div>

          <div className="panel-section">
            <div className="section-heading">
              <Search size={17} aria-hidden="true" />
              <h2>{t.area}</h2>
            </div>
            <label className="field">
              <span>{t.selectionCoverage}</span>
              <input
                type="range"
                min="180"
                max="1600"
                step="10"
                value={options.coverageMeters}
                onChange={(event) => updateOption("coverageMeters", Number(event.target.value))}
              />
              <span className="metric-row">
                <strong>{Math.round(options.coverageMeters)} m</strong>
                <span>{areaLabel}</span>
              </span>
            </label>
            <div className="extent-card">
              <span>{t.selectedFootprint}</span>
              <strong>{extent}</strong>
            </div>
            <OrientationControl value={options.orientation} onChange={(value) => updateOption("orientation", value)} t={t} />
          </div>

          <div className="panel-section">
            <div className="section-heading">
              <SlidersHorizontal size={17} aria-hidden="true" />
              <h2>{t.presets}</h2>
            </div>
            <label className="field">
              <span>{t.presets}</span>
              <select value={options.tactilePreset} onChange={(event) => applyPreset(event.target.value)}>
                <option value="plain">{t.plainPreset}</option>
                <option value="lowVision">{t.lowVisionPreset}</option>
                <option value="swell">{t.swellPreset}</option>
                <option value="embosser">{t.embosserPreset}</option>
                <option value="laser">{t.laserPreset}</option>
              </select>
            </label>
            <label className="field">
              <span>{t.qualityMode}</span>
              <select value={options.qualityMode} onChange={(event) => updateOption("qualityMode", event.target.value)}>
                <option value="fast">{t.fastPreview}</option>
                <option value="detailed">{t.detailedPreview}</option>
                <option value="export">{t.exportQuality}</option>
              </select>
            </label>
          </div>

          <div className="panel-section">
            <div className="section-heading">
              <Layers size={17} aria-hidden="true" />
              <h2>{t.features}</h2>
            </div>
            <div className="category-grid">
              {Object.entries(FEATURE_TYPES).map(([key, config]) => (
                <label key={key} className="check-row">
                  <input type="checkbox" checked={categories[key]} onChange={() => toggleCategory(key)} />
                  <span>{featureTypeLabel(config, options.uiLanguage)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <div className="section-heading">
              <Landmark size={17} aria-hidden="true" />
              <h2>{t.importance}</h2>
            </div>
            <div className="importance-grid">
              <ToggleRow checked={options.emphasizeLandmarks} label={t.emphasizeLandmarks} onChange={(value) => updateOption("emphasizeLandmarks", value)} />
              <ToggleRow checked={options.hideMinorRoads} label={t.hideMinorRoads} onChange={(value) => updateOption("hideMinorRoads", value)} />
              <ToggleRow checked={options.showOnlyLandmarks} label={t.showOnlyLandmarks} onChange={(value) => updateOption("showOnlyLandmarks", value)} />
              <ToggleRow checked={options.simplifyDenseBuildings} label={t.simplifyDenseBuildings} className="warning-toggle" onChange={(value) => updateOption("simplifyDenseBuildings", value)} />
              <ToggleRow checked={options.groupCloseBuildings} label={t.groupCloseBuildings} onChange={(value) => updateOption("groupCloseBuildings", value)} />
              <ToggleRow checked={options.prioritizePedestrianRoutes} label={t.prioritizePedestrian} onChange={(value) => updateOption("prioritizePedestrianRoutes", value)} />
            </div>
            {options.groupCloseBuildings ? (
              <label className="field nested-field">
                <span>{t.buildingGroupDistance}</span>
                <input
                  type="range"
                  min="4"
                  max="34"
                  step="1"
                  value={options.buildingGroupDistance}
                  onChange={(event) => updateOption("buildingGroupDistance", Number(event.target.value))}
                />
                <span className="metric-row">
                  <strong>{options.buildingGroupDistance} m</strong>
                  <span>{t.buildingGroupDistanceHint}</span>
                </span>
              </label>
            ) : null}
          </div>

          <div className="panel-section">
            <div className="section-heading">
              <Settings2 size={17} aria-hidden="true" />
              <h2>{t.schematic}</h2>
            </div>
            <label className="field">
              <span>{t.spacing}</span>
              <input type="range" min="0" max="40" step="1" value={options.spacing} onChange={(event) => updateOption("spacing", Number(event.target.value))} />
              <span className="metric-row">
                <strong>{options.spacing} mm</strong>
                <span>{t.schematicSeparation}</span>
              </span>
            </label>
            <label className="field">
              <span>{t.simplification}</span>
              <input type="range" min="0" max="8" step="1" value={options.simplification} onChange={(event) => updateOption("simplification", Number(event.target.value))} />
              <span className="metric-row">
                <strong>{options.simplification}</strong>
                <span>{options.simplification < 3 ? t.detailed : options.simplification < 6 ? t.balanced : t.abstract}</span>
              </span>
            </label>
            <label className="field">
              <span>{t.lineThickness}</span>
              <input
                type="range"
                min="0.4"
                max="3.8"
                step="0.1"
                value={options.lineThickness}
                onChange={(event) => updateOption("lineThickness", Number(event.target.value))}
              />
              <span className="metric-row">
                <strong>{options.lineThickness.toFixed(1)} mm</strong>
                <span>{t.strokeBase}</span>
              </span>
            </label>
            <label className="field">
              <span>{t.mapTitle}</span>
              <input type="text" value={options.title} onChange={(event) => updateOption("title", event.target.value)} />
            </label>
            <div className="toggle-grid">
              <ToggleRow checked={options.showLabels} label={t.labels} onChange={(value) => updateOption("showLabels", value)} />
              <ToggleRow checked={options.showLegend} label={t.legend} onChange={(value) => updateOption("showLegend", value)} />
            </div>
            {options.showLegend ? (
              <label className="field">
                <span>{t.legendLanguage}</span>
                <select value={options.legendMode} onChange={(event) => updateOption("legendMode", event.target.value)}>
                  <option value="both">{t.greekBrailleBoth}</option>
                  <option value="greek">{t.greekOnly}</option>
                  <option value="braille">{t.brailleOnly}</option>
                </select>
              </label>
            ) : null}
          </div>

          {error ? <ErrorBox error={error} onRetry={generate} t={t} /> : null}
          {meta ? <StatusSummary meta={meta} t={t} /> : null}
          <DeveloperContactPanel t={t} />
        </aside>

        <section className="stage-panel">
          <div className="pane-title">
            <div>
              <h2>{activeView === "map" ? t.mapSelection : t.previewTitle}</h2>
              <span>
                {activeView === "map"
                  ? t.larissa
                  : schematicSvg
                    ? `${renderFeatures.length} ${t.rendered}`
                    : t.generateToPreview}
              </span>
            </div>
            <div className="view-toggle" aria-label="Workspace view">
              <button type="button" className={activeView === "map" ? "active" : ""} onClick={() => setActiveView("map")}>
                <MapIcon size={17} aria-hidden="true" />
                {t.map}
              </button>
              <button
                type="button"
                className={`preview-toggle ${activeView === "preview" ? "active" : ""} ${schematicSvg ? "ready" : ""}`}
                onClick={() => setActiveView("preview")}
                disabled={!schematicSvg}
              >
                <Eye size={17} aria-hidden="true" />
                {t.preview}
              </button>
            </div>
          </div>

          <div className="stage-body">
            <div className={`stage-view map-view ${activeView === "map" ? "active" : ""}`} aria-hidden={activeView !== "map"}>
              <div className="map-wrap">
                <div ref={mapNode} className="leaflet-host" aria-label="Interactive OpenStreetMap selection" />
                <div className="selection-crosshair" aria-hidden="true" />
              </div>
            </div>

            <div className={`stage-view preview-view ${activeView === "preview" ? "active" : ""}`} aria-hidden={activeView !== "preview"}>
              <div className="preview-workspace">
                <div className="schematic-preview">
                  {schematicSvg ? (
                    <div className="svg-preview" dangerouslySetInnerHTML={{ __html: schematicSvg }} />
                  ) : (
                    <div className="empty-preview">
                      <MapPinned size={40} aria-hidden="true" />
                      <p>{t.emptyPreview}</p>
                    </div>
                  )}
                </div>
                {activeView === "preview" ? (
                  <PreviewTools
                    options={options}
                    t={t}
                    landmarks={landmarks}
                    excludedLandmarks={excludedLandmarks}
                    updateOption={updateOption}
                    toggleLandmark={toggleLandmark}
                    handleDownload={handleDownload}
                    exportStatus={exportStatus}
                    hasSvg={Boolean(schematicSvg)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </section>
      {supportPromptOpen ? <DownloadSupportPrompt t={t} onClose={() => setSupportPromptOpen(false)} /> : null}
    </main>
  );
}

function DeveloperContactPanel({ t }) {
  return (
    <address className="developer-contact" aria-label={t.contactDeveloper}>
      <strong>{t.contactDeveloper}</strong>
      <span>{t.developerCredit}</span>
      <a href={`mailto:${AUTHOR_CONTACT.email}`}>
        <Mail size={15} aria-hidden="true" />
        {AUTHOR_CONTACT.email}
      </a>
      <a href={AUTHOR_CONTACT.github} target="_blank" rel="noreferrer">
        <Github size={15} aria-hidden="true" />
        GitHub
      </a>
      <a href={AUTHOR_CONTACT.paypal} target="_blank" rel="noreferrer">
        <HeartHandshake size={15} aria-hidden="true" />
        {t.donatePaypal}
      </a>
    </address>
  );
}

function DownloadSupportPrompt({ t, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="support-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
        <button type="button" className="support-close" onClick={onClose} aria-label={t.close}>
          <X size={18} aria-hidden="true" />
        </button>
        <div className="support-icon" aria-hidden="true">
          <HeartHandshake size={22} />
        </div>
        <h2 id="support-modal-title">{t.supportDevelopment}</h2>
        <p>{t.developerCredit}</p>
        <p>{t.developerContactIntro}</p>
        <div className="support-link-grid">
          <a href={`mailto:${AUTHOR_CONTACT.email}`}>
            <Mail size={16} aria-hidden="true" />
            {AUTHOR_CONTACT.email}
          </a>
          <a href={AUTHOR_CONTACT.github} target="_blank" rel="noreferrer">
            <Github size={16} aria-hidden="true" />
            GitHub
          </a>
        </div>
        <p>{t.supportDevelopmentLong}</p>
        <div className="support-actions">
          <a className="support-donate" href={AUTHOR_CONTACT.paypal} target="_blank" rel="noreferrer">
            <HeartHandshake size={17} aria-hidden="true" />
            {t.donatePaypal}
          </a>
          <button type="button" className="secondary-action" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </section>
    </div>
  );
}

function PreviewTools({ options, t, landmarks, excludedLandmarks, updateOption, toggleLandmark, handleDownload, exportStatus, hasSvg }) {
  return (
    <aside className="preview-tools" aria-label={t.exportSettings}>
      <div className="tool-section">
        <div className="section-heading">
          <FileCog size={17} aria-hidden="true" />
          <h2>{t.exportSettings}</h2>
        </div>
        <OrientationControl value={options.orientation} onChange={(value) => updateOption("orientation", value)} t={t} />
        <label className="field">
          <span>{t.marginSize}</span>
          <input type="range" min="6" max="24" step="1" value={options.margin} onChange={(event) => updateOption("margin", Number(event.target.value))} />
          <span className="metric-row">
            <strong>{options.margin} mm</strong>
          </span>
        </label>
        <div className="toggle-grid">
          <ToggleRow checked={options.showScaleBar} label={t.scaleBar} onChange={(value) => updateOption("showScaleBar", value)} />
          <ToggleRow checked={options.showNorthArrow} label={t.northArrow} onChange={(value) => updateOption("showNorthArrow", value)} />
          <ToggleRow checked={options.showLandmarkLabels} label={t.landmarkLabels} onChange={(value) => updateOption("showLandmarkLabels", value)} />
          <ToggleRow checked={options.showTitle} label={t.title} onChange={(value) => updateOption("showTitle", value)} />
          <ToggleRow checked={options.showFooter} label={t.footer} onChange={(value) => updateOption("showFooter", value)} />
        </div>
        <label className="field">
          <span>{t.legendPosition}</span>
          <select value={options.legendPosition} onChange={(event) => updateOption("legendPosition", event.target.value)} disabled={!options.showLegend}>
            <option value="bottom-left">{t.bottomLeft}</option>
            <option value="bottom-right">{t.bottomRight}</option>
            <option value="top-left">{t.topLeft}</option>
            <option value="top-right">{t.topRight}</option>
          </select>
        </label>
        <div className="export-row preview-export-row">
          <button type="button" className="icon-button" title={t.downloadSvg} aria-label={t.downloadSvg} onClick={() => handleDownload("svg")} disabled={!hasSvg}>
            <Download size={18} aria-hidden="true" />
            SVG
          </button>
          <button type="button" className="icon-button" title={t.downloadPng} aria-label={t.downloadPng} onClick={() => handleDownload("png")} disabled={!hasSvg}>
            <ImageDown size={18} aria-hidden="true" />
            PNG
          </button>
          <button type="button" className="icon-button" title={t.downloadPdf} aria-label={t.downloadPdf} onClick={() => handleDownload("pdf")} disabled={!hasSvg}>
            <FileDown size={18} aria-hidden="true" />
            PDF
          </button>
        </div>
        {exportStatus ? <div className="export-status">{exportStatus}</div> : null}
      </div>

      <div className="tool-section landmark-panel">
        <div className="section-heading">
          <ListChecks size={17} aria-hidden="true" />
          <h2>{t.landmarkSummary}</h2>
        </div>
        {landmarks.total === 0 ? (
          <p className="muted-note">{t.noLandmarks}</p>
        ) : (
          <div className="landmark-groups">
            {LANDMARK_CATEGORIES.map((category) => {
              const group = landmarks.groups[category] ?? [];
              if (group.length === 0) {
                return null;
              }
              return (
                <details key={category} open={category === "schools" || category === "churches"}>
                  <summary>
                    <span>{landmarkCategoryLabel(category, options.uiLanguage)}</span>
                    <strong>{group.length} {t.detected}</strong>
                  </summary>
                  <div className="landmark-list">
                    {group.map((feature) => {
                      const key = landmarkKey(feature);
                      return (
                        <label key={key} className="landmark-row">
                          <input type="checkbox" checked={!excludedLandmarks[key]} onChange={() => toggleLandmark(key)} />
                          <span>{landmarkDisplayName(feature, options.uiLanguage)}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function LanguageToggle({ language, onChange }) {
  return (
    <div className="language-flags" aria-label="UI language">
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => onChange("en")}
        title="English"
        aria-label="Switch UI language to English"
      >
        🇺🇸
      </button>
      <button
        type="button"
        className={language === "el" ? "active" : ""}
        onClick={() => onChange("el")}
        title="Ελληνικά"
        aria-label="Αλλαγή γλώσσας σε ελληνικά"
      >
        🇬🇷
      </button>
    </div>
  );
}

function OrientationControl({ value, onChange, t }) {
  return (
    <div className="segmented" aria-label="A4 orientation">
      <button type="button" className={value === "portrait" ? "active" : ""} onClick={() => onChange("portrait")}>
        {t.portrait}
      </button>
      <button type="button" className={value === "landscape" ? "active" : ""} onClick={() => onChange("landscape")}>
        {t.landscape}
      </button>
    </div>
  );
}

function ToggleRow({ checked, label, onChange, className = "" }) {
  return (
    <label className={`switch-row ${className}`.trim()}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ErrorBox({ error, onRetry, t }) {
  return (
    <div className="error-box">
      <div className="error-heading">
        <AlertTriangle size={17} aria-hidden="true" />
        <strong>{t.offlineTitle}</strong>
      </div>
      <p>{t.offlineHelp}</p>
      <pre>{error}</pre>
      <button type="button" className="secondary-action" onClick={onRetry}>
        <RefreshCcw size={16} aria-hidden="true" />
        {t.retry}
      </button>
    </div>
  );
}

function StatusSummary({ meta, t }) {
  return (
    <div className="status-box">
      <span>{t.dataSource}</span>
      <strong>{new URL(meta.endpoint).hostname}</strong>
      <span>{t.osmFeatures}</span>
      <strong>
        {meta.rendered} {t.rendered}
        {meta.truncated ? `, ${meta.truncated} ${t.hiddenByLimits}` : ""}
      </strong>
      {meta.fallback ? (
        <>
          <span>Fallback</span>
          <strong>{meta.fallback}</strong>
        </>
      ) : null}
    </div>
  );
}

async function fetchWithFallback(bounds, selectedCategories, setProgressMessage, t) {
  try {
    return await fetchOsmFeatures(bounds, selectedCategories);
  } catch (error) {
    if (!selectedCategories.includes("buildings")) {
      throw error;
    }

    setProgressMessage(t.retryingLight);
    const lighterCategories = selectedCategories.filter((category) => category !== "buildings");
    const result = await fetchOsmFeatures(bounds, lighterCategories);
    return {
      ...result,
      meta: {
        ...result.meta,
        fallback: "without buildings"
      }
    };
  }
}

function buildRenderOptions(options) {
  const quality = QUALITY_MODES[options.qualityMode] ?? QUALITY_MODES.detailed;
  return {
    ...options,
    simplification: clamp(options.simplification + quality.simplificationDelta + (options.simplifyDenseBuildings ? 1 : 0), 0, 9),
    labelDensity: quality.labelDensity,
    collisionBoost: quality.collisionBoost
  };
}

function prepareRenderFeatures(features, options, excludedLandmarks, bounds) {
  const quality = QUALITY_MODES[options.qualityMode] ?? QUALITY_MODES.detailed;
  const groupedCounts = {};
  const buildingLimit = options.simplifyDenseBuildings ? Math.round(quality.caps.buildings * 0.55) : quality.caps.buildings;
  const filteredFeatures = features
    .map((feature) => decorateFeature(feature, options))
    .filter((feature) => !excludedLandmarks[landmarkKey(feature)])
    .filter((feature) => !options.showOnlyLandmarks || LANDMARK_CATEGORIES.includes(feature.category))
    .filter((feature) => roadFilter(feature, options));
  const groupedFeatures = options.groupCloseBuildings
    ? groupCloseBuildings(filteredFeatures, bounds, options)
    : filteredFeatures;

  return groupedFeatures
    .filter((feature) => {
      const limit = feature.category === "buildings" ? buildingLimit : quality.caps[feature.category] ?? 1000;
      groupedCounts[feature.category] = (groupedCounts[feature.category] ?? 0) + 1;
      return groupedCounts[feature.category] <= limit;
    });
}

function decorateFeature(feature, options) {
  const highway = feature.tags?.highway;
  const isPedestrianPriority = options.prioritizePedestrianRoutes && feature.category === "roads" && PEDESTRIAN_ROADS.has(highway);
  const isLandmark = LANDMARK_CATEGORIES.includes(feature.category);
  const emphasized = options.emphasizeLandmarks && ["schools", "churches", "medical"].includes(feature.category);
  return {
    ...feature,
    isPriorityPedestrian: isPedestrianPriority,
    emphasized,
    importance: feature.importance + (isPedestrianPriority ? 8 : 0) + (emphasized || isLandmark ? 4 : 0)
  };
}

function roadFilter(feature, options) {
  if (feature.category !== "roads") {
    return true;
  }
  const highway = feature.tags?.highway;
  if (!options.hideMinorRoads) {
    return true;
  }
  if (options.prioritizePedestrianRoutes && PEDESTRIAN_ROADS.has(highway)) {
    return true;
  }
  return !MINOR_ROADS.has(highway);
}

function groupCloseBuildings(features, bounds, options) {
  const groupable = features.filter((feature) => feature.category === "buildings" && feature.type === "polygon" && feature.points.length >= 3);
  if (groupable.length < 2) {
    return features;
  }

  const gapMeters = clamp(Number(options.buildingGroupDistance) || 12, 4, 34);
  const maxSpanMeters = Math.max(48, gapMeters * 5.5);
  const origin = {
    lat: (bounds.north + bounds.south) / 2,
    lon: (bounds.east + bounds.west) / 2
  };
  const records = groupable.map((feature, index) => {
    const localPoints = feature.points.map((point) => geoToLocalMeters(point, origin));
    return {
      index,
      feature,
      localPoints,
      box: boxFromPoints(localPoints)
    };
  });

  const parents = records.map((_, index) => index);
  const ranks = records.map(() => 0);
  const clusterBoxes = records.map((record) => ({ ...record.box }));

  const find = (index) => {
    if (parents[index] !== index) {
      parents[index] = find(parents[index]);
    }
    return parents[index];
  };

  const unite = (leftIndex, rightIndex) => {
    let leftRoot = find(leftIndex);
    let rightRoot = find(rightIndex);
    if (leftRoot === rightRoot) {
      return;
    }

    const mergedBox = mergeBoxes(clusterBoxes[leftRoot], clusterBoxes[rightRoot]);
    if (Math.max(mergedBox.maxX - mergedBox.minX, mergedBox.maxY - mergedBox.minY) > maxSpanMeters) {
      return;
    }

    if (ranks[leftRoot] < ranks[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }

    parents[rightRoot] = leftRoot;
    clusterBoxes[leftRoot] = mergedBox;
    if (ranks[leftRoot] === ranks[rightRoot]) {
      ranks[leftRoot] += 1;
    }
  };

  for (let left = 0; left < records.length - 1; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      if (boxDistance(records[left].box, records[right].box) <= gapMeters) {
        unite(left, right);
      }
    }
  }

  const clusters = new Map();
  records.forEach((record, index) => {
    const root = find(index);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root).push(record);
  });

  const groupedIds = new Set();
  const buildingGroups = [];
  let groupIndex = 0;
  clusters.forEach((cluster) => {
    if (cluster.length < 2) {
      return;
    }

    cluster.forEach((record) => groupedIds.add(record.feature.id));
    buildingGroups.push(buildBuildingGroupFeature(cluster, origin, gapMeters, options, groupIndex));
    groupIndex += 1;
  });

  if (buildingGroups.length === 0) {
    return features;
  }

  return features.filter((feature) => !groupedIds.has(feature.id)).concat(buildingGroups);
}

function buildBuildingGroupFeature(cluster, origin, gapMeters, options, groupIndex) {
  const localPoints = cluster.flatMap((record) => record.localPoints);
  const box = boxFromPoints(localPoints);
  const padding = Math.min(7, Math.max(2, gapMeters * 0.22));
  const hull = expandHull(convexHull(localPoints), box, padding);
  const count = cluster.length;
  const label =
    count >= 4
      ? options.uiLanguage === "el"
        ? `${count} κτίρια`
        : `${count} buildings`
      : "";
  const maxImportance = Math.max(...cluster.map((record) => record.feature.importance ?? 0));

  return {
    id: `building-group/${groupIndex}`,
    osmId: `building-group/${groupIndex}`,
    category: "buildings",
    type: "polygon",
    points: hull.map((point) => localMetersToGeo(point, origin)),
    label,
    tags: {
      building: "group",
      buildingGroup: "true",
      groupedCount: String(count)
    },
    importance: maxImportance + Math.min(count, 12)
  };
}

function geoToLocalMeters(point, origin) {
  const metersPerLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (point.lon - origin.lon) * metersPerLon,
    y: (point.lat - origin.lat) * 111320
  };
}

function localMetersToGeo(point, origin) {
  const metersPerLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + point.y / 111320,
    lon: origin.lon + point.x / metersPerLon
  };
}

function boxFromPoints(points) {
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function mergeBoxes(left, right) {
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY)
  };
}

function boxDistance(left, right) {
  const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX);
  const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY);
  return Math.hypot(dx, dy);
}

function convexHull(points) {
  const unique = Array.from(new Map(points.map((point) => [`${point.x.toFixed(3)},${point.y.toFixed(3)}`, point])).values())
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length <= 3) {
    return unique;
  }

  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function expandHull(hull, box, padding) {
  const baseHull = hull.length >= 3 ? hull : boxToPolygon(box);
  const center = {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2
  };

  return baseHull.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) {
      return point;
    }

    return {
      x: point.x + (dx / length) * padding,
      y: point.y + (dy / length) * padding
    };
  });
}

function boxToPolygon(box) {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY }
  ];
}

function cross(origin, left, right) {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}

function buildLandmarkSummary(features) {
  const groups = Object.fromEntries(LANDMARK_CATEGORIES.map((category) => [category, []]));
  const seen = new Set();

  for (const feature of features) {
    if (!LANDMARK_CATEGORIES.includes(feature.category)) {
      continue;
    }
    const key = landmarkKey(feature);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    groups[feature.category].push(feature);
  }

  for (const category of LANDMARK_CATEGORIES) {
    groups[category] = groups[category]
      .sort((a, b) => b.importance - a.importance || landmarkDisplayName(a, "en").localeCompare(landmarkDisplayName(b, "en")))
      .slice(0, 40);
  }

  return {
    groups,
    total: LANDMARK_CATEGORIES.reduce((sum, category) => sum + groups[category].length, 0)
  };
}

function landmarkKey(feature) {
  return feature.osmId || feature.id;
}

function landmarkDisplayName(feature, language) {
  const fallback = language === "el" ? FEATURE_TYPES[feature.category]?.greek : FEATURE_TYPES[feature.category]?.label;
  return feature.label || fallback || feature.category;
}

function landmarkCategoryLabel(category, language) {
  return language === "el" ? FEATURE_TYPES[category]?.greek : FEATURE_TYPES[category]?.label;
}

function featureTypeLabel(config, language) {
  return language === "el" ? config.greek : config.label;
}

function formatFetchError(error, t) {
  const detail = String(error?.message || error || "");
  return `${t.offlineTitle}\n${detail}`;
}

function waitForUi() {
  return new Promise((resolve) => window.setTimeout(resolve, 80));
}

function boundsFromCenter(center, coverageMeters, orientation, showLegend, legendPosition) {
  const mapAspect = outputMapAspect(orientation, showLegend, legendPosition);
  const isLandscape = mapAspect >= 1;
  const widthMeters = isLandscape ? coverageMeters : coverageMeters * mapAspect;
  const heightMeters = isLandscape ? coverageMeters / mapAspect : coverageMeters;
  const latDelta = (heightMeters / 2) / 111320;
  const lonDelta = (widthMeters / 2) / (111320 * Math.cos((center.lat * Math.PI) / 180));

  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lonDelta,
    west: center.lng - lonDelta
  };
}

function outputMapAspect(orientation, showLegend, legendPosition) {
  const paper = orientation === "landscape" ? { width: 297, height: 210 } : { width: 210, height: 297 };
  const margin = 12;
  const legend = showLegend && legendPosition?.startsWith("bottom") ? 40 : 0;
  return (paper.width - margin * 2) / (paper.height - margin * 2 - legend);
}

function leafletBounds(bounds) {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
  ];
}

function formatBoundsSize(bounds) {
  const centerLat = (bounds.north + bounds.south) / 2;
  const width = distanceMeters(centerLat, bounds.west, centerLat, bounds.east);
  const height = distanceMeters(bounds.south, (bounds.west + bounds.east) / 2, bounds.north, (bounds.west + bounds.east) / 2);
  return `${Math.round(width)} m x ${Math.round(height)} m`;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
