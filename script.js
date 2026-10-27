"use strict";

/* ---------- Config: all API URLs in one place ---------- */
var API = {
  geocoding: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast"
};
var STORAGE_KEY = "lastCity";
var DEBOUNCE_MS = 400;

/* ---------- Weather codes (Open-Meteo WMO table) -> label, theme, icon ---------- */
var WEATHER_CODES = {
  0:  { label: "Clear sky",           theme: "clear",  icon: "sun" },
  1:  { label: "Mainly clear",        theme: "clear",  icon: "sun" },
  2:  { label: "Partly cloudy",       theme: "cloudy", icon: "partly" },
  3:  { label: "Overcast",            theme: "cloudy", icon: "cloud" },
  45: { label: "Fog",                 theme: "fog",    icon: "fog" },
  48: { label: "Freezing fog",        theme: "fog",    icon: "fog" },
  51: { label: "Light drizzle",       theme: "rain",   icon: "rain" },
  53: { label: "Drizzle",             theme: "rain",   icon: "rain" },
  55: { label: "Heavy drizzle",       theme: "rain",   icon: "rain" },
  56: { label: "Freezing drizzle",    theme: "rain",   icon: "rain" },
  57: { label: "Freezing drizzle",    theme: "rain",   icon: "rain" },
  61: { label: "Light rain",          theme: "rain",   icon: "rain" },
  63: { label: "Rain",                theme: "rain",   icon: "rain" },
  65: { label: "Heavy rain",          theme: "rain",   icon: "rain" },
  66: { label: "Freezing rain",       theme: "rain",   icon: "rain" },
  67: { label: "Freezing rain",       theme: "rain",   icon: "rain" },
  71: { label: "Light snow",          theme: "snow",   icon: "snow" },
  73: { label: "Snow",                theme: "snow",   icon: "snow" },
  75: { label: "Heavy snow",          theme: "snow",   icon: "snow" },
  77: { label: "Snow grains",         theme: "snow",   icon: "snow" },
  80: { label: "Light showers",       theme: "rain",   icon: "rain" },
  81: { label: "Showers",             theme: "rain",   icon: "rain" },
  82: { label: "Violent showers",     theme: "rain",   icon: "rain" },
  85: { label: "Snow showers",        theme: "snow",   icon: "snow" },
  86: { label: "Heavy snow showers",  theme: "snow",   icon: "snow" },
  95: { label: "Thunderstorm",        theme: "storm",  icon: "storm" },
  96: { label: "Thunderstorm, hail",  theme: "storm",  icon: "storm" },
  99: { label: "Thunderstorm, hail",  theme: "storm",  icon: "storm" }
};
var UNKNOWN_WEATHER = { label: "Unknown", theme: "cloudy", icon: "cloud" };

function describeCode(code) {
  return WEATHER_CODES[code] || UNKNOWN_WEATHER;
}

/* ---------- SVG icons (built with DOM calls, no innerHTML) ---------- */
var SVG_NS = "http://www.w3.org/2000/svg";
var CLOUD = "M20 46a10 10 0 0 1-1-20 14 14 0 0 1 27 2 9 9 0 0 1-1 18z";
var ICON_SHAPES = {
  sun:    [["circle", { cx: 32, cy: 32, r: 10 }],
           ["path", { d: "M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4 4M45 45l4 4M49 15l-4 4M19 45l-4 4" }]],
  cloud:  [["path", { d: CLOUD }]],
  partly: [["circle", { cx: 22, cy: 20, r: 7 }],
           ["path", { d: "M22 6v3M8 20h3M12 10l2 2M32 10l-2 2" }],
           ["path", { d: "M24 52a9 9 0 0 1-1-18 12 12 0 0 1 23 2 8 8 0 0 1-1 16z" }]],
  rain:   [["path", { d: "M20 40a10 10 0 0 1-1-18 14 14 0 0 1 27 2 9 9 0 0 1-1 16z" }],
           ["path", { d: "M22 48l-3 8M34 48l-3 8M46 48l-3 8" }]],
  snow:   [["path", { d: "M20 40a10 10 0 0 1-1-18 14 14 0 0 1 27 2 9 9 0 0 1-1 16z" }],
           ["circle", { cx: 22, cy: 52, r: 1.5 }], ["circle", { cx: 34, cy: 52, r: 1.5 }],
           ["circle", { cx: 46, cy: 52, r: 1.5 }]],
  storm:  [["path", { d: "M20 38a10 10 0 0 1-1-17 14 14 0 0 1 27 2 9 9 0 0 1-1 15z" }],
           ["path", { d: "M34 38l-8 11h8l-5 10" }]],
  fog:    [["path", { d: "M10 22h44M16 32h36M10 42h44M18 52h30" }]]
};

function makeIcon(name) {
  var svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  (ICON_SHAPES[name] || ICON_SHAPES.cloud).forEach(function (shape) {
    var el = document.createElementNS(SVG_NS, shape[0]);
    Object.keys(shape[1]).forEach(function (k) { el.setAttribute(k, shape[1][k]); });
    svg.appendChild(el);
  });
  return svg;
}

/* ---------- Data layer ---------- */
async function findCity(name) {
  var url = API.geocoding + "?count=1&language=en&format=json&name=" + encodeURIComponent(name);
  var res = await fetch(url);
  if (!res.ok) throw new Error("The search service is not responding. Try again soon.");
  var data = await res.json();
  if (!data.results || !data.results.length) {
    throw new CityNotFoundError("City not found. Check the spelling or try a nearby city.");
  }
  var c = data.results[0];
  return { name: c.name, country: c.country || "", region: c.admin1 || "", lat: c.latitude, lon: c.longitude };
}

async function getWeather(lat, lon) {
  var url = API.forecast +
    "?latitude=" + encodeURIComponent(lat) +
    "&longitude=" + encodeURIComponent(lon) +
    "&current=temperature_2m,weather_code" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&forecast_days=5&timezone=auto";
  var res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the forecast. Try again soon.");
  return res.json();
}

/* A separate error type lets us tell "no such city" apart from a network failure */
function CityNotFoundError(message) {
  this.name = "CityNotFoundError";
  this.message = message;
}
CityNotFoundError.prototype = Object.create(Error.prototype);

/* ---------- Validation ---------- */
function validateCity(value) {
  var name = value.trim();
  if (!name) return "Type a city name to search.";
  if (name.length < 2) return "Enter at least 2 characters.";
  if (!/^[\p{L}\p{M}\s.'\-,]+$/u.test(name)) return "Use letters only. Numbers and symbols are not city names.";
  return "";
}

function debounce(fn, ms) {
  var timer;
  return function () {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(null, args); }, ms);
  };
}

/* ---------- Rendering (all text via textContent) ---------- */
var els = {
  form: document.getElementById("form"),
  input: document.getElementById("city"),
  button: document.getElementById("submit"),
  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
  current: document.getElementById("current"),
  forecastWrap: document.getElementById("forecast-wrap"),
  forecast: document.getElementById("forecast")
};

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTemp(n) { return Math.round(n) + "\u00B0C"; }

function setStatus(message, kind) {
  els.status.textContent = message;
  els.status.className = "status" + (kind ? " " + kind : "");
}

function setLoading(isLoading) {
  els.button.disabled = isLoading;
  els.button.textContent = isLoading ? "Loading" : "Get weather";
}

function clearResults() {
  els.current.hidden = true;
  els.forecastWrap.hidden = true;
  els.current.replaceChildren();
  els.forecast.replaceChildren();
}

function renderCurrent(city, weather) {
  var info = describeCode(weather.current.weather_code);
  var placeParts = [city.name, city.region, city.country].filter(Boolean);

  var text = el("div");
  text.appendChild(el("p", "place", placeParts.join(", ")));
  text.appendChild(el("p", "temp", formatTemp(weather.current.temperature_2m)));
  text.appendChild(el("p", "label", info.label));
  text.appendChild(el("p", "range",
    "Today: " + formatTemp(weather.daily.temperature_2m_max[0]) +
    " high, " + formatTemp(weather.daily.temperature_2m_min[0]) + " low"));

  els.current.replaceChildren(makeIcon(info.icon), text);
  els.current.hidden = false;
  document.body.setAttribute("data-theme", info.theme);
}

function renderForecast(weather) {
  var daily = weather.daily;
  els.forecast.replaceChildren();
  daily.time.forEach(function (iso, i) {
    var info = describeCode(daily.weather_code[i]);
    var date = new Date(iso + "T00:00:00");
    var card = el("article", "day");
    card.appendChild(el("p", "date",
      date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })));
    card.appendChild(makeIcon(info.icon));
    card.appendChild(el("p", "label", info.label));
    var temps = el("p");
    temps.appendChild(el("span", "hi", formatTemp(daily.temperature_2m_max[i])));
    temps.appendChild(document.createTextNode(" / "));
    temps.appendChild(el("span", "lo", formatTemp(daily.temperature_2m_min[i])));
    card.appendChild(temps);
    els.forecast.appendChild(card);
  });
  els.forecastWrap.hidden = false;
}

/* ---------- Controller ---------- */
var busy = false;

async function search(rawName) {
  var problem = validateCity(rawName);
  if (problem) { showHint(problem); setStatus(problem, "error"); return; }
  if (busy) return;               // ignore double submits

  var name = rawName.trim();
  busy = true;
  showHint("");
  setLoading(true);
  setStatus("Loading weather for " + name, "loading");

  try {
    var city = await findCity(name);
    var weather = await getWeather(city.lat, city.lon);
    renderCurrent(city, weather);
    renderForecast(weather);
    setStatus("Updated for " + city.name + ".");
    saveCity(city.name);
  } catch (err) {
    clearResults();
    if (err instanceof CityNotFoundError) {
      setStatus(err.message, "error");
    } else if (err instanceof TypeError) {
      // fetch() rejects with TypeError when the network is down or blocked
      setStatus("Network problem. Check your connection and try again.", "error");
    } else {
      setStatus(err.message || "Something went wrong. Try again.", "error");
    }
  } finally {
    busy = false;
    setLoading(false);
  }
}

function showHint(message) {
  els.hint.textContent = message;
  els.input.setAttribute("aria-invalid", message ? "true" : "false");
}

/* Debounced live validation: no API calls while typing, just feedback */
var liveValidate = debounce(function () {
  var value = els.input.value;
  showHint(value.trim() ? validateCity(value) : "");
}, DEBOUNCE_MS);

function saveCity(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch (e) { /* storage may be blocked */ }
}
function loadCity() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { return ""; }
}

els.form.addEventListener("submit", function (e) {
  e.preventDefault();
  search(els.input.value);
});
els.input.addEventListener("input", liveValidate);

var last = loadCity();
if (last) {
  els.input.value = last;
  search(last);
}
