# Live Weather Dashboard (Project 04)

Search a city and see live conditions plus a 5-day forecast, using the free
Open-Meteo geocoding and forecast APIs (no API key needed).

## Run it
Open the folder in VS Code and start **Live Server** on `index.html`
(or run `python3 -m http.server` and open http://localhost:8000).

## Files
- `index.html` – empty search form, status area, current card and forecast area
- `style.css` – responsive layout; page tint changes with the weather
- `script.js` – `findCity`, `getWeather`, weather-code map, rendering, states

## How errors are handled (for your submission note)
- Every `fetch` result is checked with `response.ok` before `.json()` is read.
- Empty or invalid input is caught before any request is sent, with a hint under the box.
- No geocoding results throws `CityNotFoundError` -> "City not found" message.
- `fetch` failing outright (offline, blocked) is a `TypeError` -> "Network problem" message.
- Other HTTP failures show a specific "not responding" / "could not load forecast" message.
- The button is disabled while loading, and a `busy` flag ignores double submits.
- Typing never calls the API; a 400 ms debounced validator only shows hints.
- All API text is placed in the page with `textContent`, never `innerHTML`.

## Publish with GitHub Pages
1. Create a GitHub repo and upload these files.
2. Settings -> Pages -> Source: `main` branch, `/ (root)`.
3. Submit the live URL and the repo URL.
