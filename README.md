# NOW THERE

**What time is it there right now?**

NOW THERE is a lightweight global time dashboard built with plain HTML, CSS and JavaScript. It is designed to make world time feel visual and immediately useful instead of looking like a conventional world-clock utility.

## Current MVP

- Live local time across 247 countries and regions
- Search by country, city or IANA timezone
- Korean/localized country-name search through `Intl.DisplayNames`
- Working / lunch / after-hours / sleeping / weekend status
- Personal modular dashboard
- Drag-and-drop card ordering
- Small / medium / large card sizes
- Browser persistence with `localStorage`
- Global time-shift slider from -24h to +24h
- 12h / 24h toggle
- Light / dark mode
- Responsive desktop and mobile layout
- No framework, build step, API key or backend required

## Files

```text
index.html     Main page structure
styles.css     Visual system and responsive layout
countries.js  Country → IANA timezone data
app.js         Search, clocks, status, dashboard and interactions
```

## Run locally

Open `index.html` directly or serve the folder with any static web server.

For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

This project is fully static, so it can be deployed directly with GitHub Pages from the `main` branch root.

## Product direction

The first version focuses on four actions:

1. **SEARCH** — find anywhere in the world
2. **SEE NOW** — understand the local time and current daily status
3. **ADD** — keep the places you check often
4. **ARRANGE** — build your own global-time dashboard

Default workday status currently assumes **09:00–18:00 local time**. Public holidays and country-specific work schedules can be added in a later version.
