# Haptic Map Schematic, by Bouronikos Christos

Live site: [https://christosbouronikos.github.io/haptic-map-schematic/](https://christosbouronikos.github.io/haptic-map-schematic/)

A GitHub Pages-ready React/Vite app for selecting an OpenStreetMap area and generating a top-down A4 schematic for visual impairment accessibility planning.

## Author

- Bouronikos Christos
- Email: [chrisbouronikos@gmail.com](mailto:chrisbouronikos@gmail.com)
- GitHub: [https://github.com/ChristosBouronikos](https://github.com/ChristosBouronikos)
- PayPal: [https://paypal.me/christosbouronikos](https://paypal.me/christosbouronikos)

## Features

- Leaflet map centered on Larissa, Greece.
- Adjustable selected area size with portrait/landscape A4 aspect handling.
- OpenStreetMap feature extraction through public Overpass API mirrors.
- English/Greek UI toggle.
- User controls for feature categories, stronger road/building spacing, simplification, line thickness, labels, and legend.
- Feature importance controls for landmarks, minor roads, pedestrian routes, and dense buildings.
- Optional close-building grouping with a meter-based merge distance for dense central areas.
- Tactile presets for plain paper preview, low-vision high contrast, swell paper, embosser, and laser cut.
- Preview quality modes for fast preview, detailed preview, and export quality.
- Preview-only export settings for A4 orientation, margins, scale bar, north arrow, legend position, title, and footer.
- Preview-only landmark label toggle for hiding school, church, park, medical, and public-service labels.
- Landmark summary panel for including or excluding detected schools, churches, parks, medical places, and public buildings.
- Compact bottom-left legend with Greek text, Modern Greek Braille, or both.
- A4 preview and export to SVG, PNG, and PDF.
- Standout Contact Developer panel plus a post-download contact/support prompt with email, GitHub, and PayPal links.
- Slow/offline Overpass handling with progress messages, retry guidance, and a lighter fallback request when dense building data fails.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The Vite base path is `./`, so the generated `dist` folder can run from a GitHub Pages project site path.
