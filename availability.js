// Availability status: location, local time, working-hours dot, and live weather.
// Dot states: available (green, weekday within hours), away (grey, weekday
// outside hours), weekend (red, Sat/Sun all day).
// Configured via data attributes:
//   data-availability  — presence enables the widget
//   data-tz            — IANA timezone (default Europe/Berlin)
//   data-start         — working-hours start hour, 0-23 (default 7)
//   data-end           — working-hours end hour, 0-23 (default 21)
//   data-location      — display label for the city (optional)
//   data-lat / data-lon — coordinates for weather lookup (optional)
(function () {
  var WEATHER_REFRESH_MS = 30 * 60 * 1000;
  var CACHE_KEY = "kreth-availability";

  var ICONS = {
    clear: '<path d="M12 4a1 1 0 0 1 1 1v1.1a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 12.9a1 1 0 0 1 1 1V19a1 1 0 1 1-2 0v-1.1a1 1 0 0 1 1-1ZM4 12a1 1 0 0 1 1-1h1.1a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm12.9 0a1 1 0 0 1 1-1H19a1 1 0 1 1 0 2h-1.1a1 1 0 0 1-1-1ZM6.3 6.3a1 1 0 0 1 1.4 0l.8.8a1 1 0 1 1-1.4 1.4l-.8-.8a1 1 0 0 1 0-1.4Zm10.5 10.5a1 1 0 0 1 1.4 0l.8.8a1 1 0 0 1-1.4 1.4l-.8-.8a1 1 0 0 1 0-1.4ZM6.3 17.7a1 1 0 0 1 0-1.4l.8-.8a1 1 0 1 1 1.4 1.4l-.8.8a1 1 0 0 1-1.4 0Zm10.5-10.5a1 1 0 0 1 0-1.4l.8-.8a1 1 0 1 1 1.4 1.4l-.8.8a1 1 0 0 1-1.4 0ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',
    "clear-night":
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    cloudy:
      '<path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 8.4 4.5 4.5 0 0 0 7.5 18.5Z"/>',
    "partly-cloudy":
      '<path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 8.4 4.5 4.5 0 0 0 7.5 18.5Z"/><path d="M12 3.5V5.8M12 3.5h1.6M12 3.5 10.4 5.1M16.2 5.8l-1.1 1.1M7.8 5.8 8.9 6.9M18.5 12h-2.3M5.5 12H3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    "partly-cloudy-night":
      '<path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 8.4 4.5 4.5 0 0 0 7.5 18.5Z"/><path d="M16.5 4.5a4.2 4.2 0 0 0-5.2 5.2A3.4 3.4 0 0 1 16.5 4.5Z"/>',
    fog: '<path d="M4 10.5h16M5.5 14h13M4 17.5h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    drizzle:
      '<path d="M7.5 13.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 3.4 4.5 4.5 0 0 0 7.5 13.5Z"/><path d="M9 17.5v2M12 17.5v2M15 17.5v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    rain: '<path d="M7.5 12.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 2.4 4.5 4.5 0 0 0 7.5 12.5Z"/><path d="M8.5 16.5v3M12 15.5v3M15.5 16.5v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    snow: '<path d="M7.5 12.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 2.4 4.5 4.5 0 0 0 7.5 12.5Z"/><path d="M9 16.5h.01M12 16.5h.01M15 16.5h.01M10.5 18.5h.01M13.5 18.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    thunder:
      '<path d="M7.5 12.5h9.2a4.3 4.3 0 0 0 .2-8.6A5.8 5.8 0 0 0 6.4 2.4 4.5 4.5 0 0 0 7.5 12.5Z"/><path d="M13.2 14.5 11 18.5h2.4l-1.6 3.5 4.2-5.5h-2.5l1.7-2Z"/>',
  };

  var LABELS = {
    clear: "Clear sky",
    "clear-night": "Clear sky",
    cloudy: "Cloudy",
    "partly-cloudy": "Partly cloudy",
    "partly-cloudy-night": "Partly cloudy",
    fog: "Foggy",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    thunder: "Thunderstorm",
  };

  function iconSvg(name) {
    var body = ICONS[name] || ICONS.cloudy;
    return (
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      body +
      "</svg>"
    );
  }

  function codeToIcon(code, isDay) {
    if (code === 0) return isDay ? "clear" : "clear-night";
    if (code === 1) return isDay ? "partly-cloudy" : "partly-cloudy-night";
    if (code === 2 || code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 57) return "drizzle";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
    if (code >= 95) return "thunder";
    return "cloudy";
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function cacheMatches(el, cache) {
    if (!cache || !el) return false;
    var lat = el.getAttribute("data-lat");
    var lon = el.getAttribute("data-lon");
    if (lat && cache.lat && lat !== cache.lat) return false;
    if (lon && cache.lon && lon !== cache.lon) return false;
    return true;
  }

  function applyCache(el, cache) {
    if (!cacheMatches(el, cache)) return;

    var timeEl = el.querySelector(".availability__time");
    var weatherEl = el.querySelector(".availability__weather");

    if (timeEl && cache.time) timeEl.textContent = cache.time;
    if (weatherEl && cache.weatherHtml) {
      weatherEl.innerHTML = cache.weatherHtml;
      if (cache.weatherTitle) {
        weatherEl.setAttribute("title", cache.weatherTitle);
      }
    }
    if (cache.available != null) {
      el.setAttribute("data-available", cache.available ? "true" : "false");
    }
    if (cache.state) el.setAttribute("data-state", cache.state);
    if (cache.title) el.setAttribute("title", cache.title);
    if (cache.ariaLabel) el.setAttribute("aria-label", cache.ariaLabel);
  }

  function writeCache(el, patch) {
    if (!el) return;
    var weatherEl = el.querySelector(".availability__weather");
    var timeEl = el.querySelector(".availability__time");
    var next = Object.assign({}, readCache() || {}, patch, {
      lat: el.getAttribute("data-lat") || "",
      lon: el.getAttribute("data-lon") || "",
      time: timeEl ? timeEl.textContent : patch.time,
      weatherHtml: weatherEl ? weatherEl.innerHTML : patch.weatherHtml,
      weatherTitle: weatherEl ? weatherEl.getAttribute("title") : patch.weatherTitle,
      available: el.getAttribute("data-available") === "true",
      state: el.getAttribute("data-state") || "",
      title: el.getAttribute("title"),
      ariaLabel: el.getAttribute("aria-label"),
    });

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch (_) {}
  }

  window.restoreAvailabilityCache = function (root) {
    var scope = root || document;
    var el = scope.querySelector
      ? scope.querySelector("[data-availability]")
      : null;
    if (!el) return;
    applyCache(el, readCache());
  };

  function fetchWeather(el, weatherEl) {
    var lat = el.getAttribute("data-lat");
    var lon = el.getAttribute("data-lon");
    if (!lat || !lon || !weatherEl) return;

    var cache = readCache();
    if (
      cacheMatches(el, cache) &&
      cache.weatherHtml &&
      cache.weatherFetchedAt &&
      Date.now() - cache.weatherFetchedAt < WEATHER_REFRESH_MS
    ) {
      return;
    }

    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(lat) +
      "&longitude=" +
      encodeURIComponent(lon) +
      "&current=weather_code,is_day&timezone=auto";

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("weather");
        return res.json();
      })
      .then(function (data) {
        var current = data && data.current;
        if (!current) return;
        var icon = codeToIcon(current.weather_code, current.is_day === 1);
        weatherEl.innerHTML = iconSvg(icon);
        weatherEl.setAttribute("title", LABELS[icon] || "Weather");
        writeCache(el, {
          weatherFetchedAt: Date.now(),
          weatherTitle: LABELS[icon] || "Weather",
        });
      })
      .catch(function () {
        if (weatherEl.innerHTML) return;
        weatherEl.innerHTML = iconSvg("cloudy");
        weatherEl.setAttribute("title", "Weather unavailable");
        writeCache(el, {
          weatherFetchedAt: Date.now(),
          weatherTitle: "Weather unavailable",
        });
      });
  }

  function init(el) {
    if (el.dataset.availabilityReady) return;
    el.dataset.availabilityReady = "1";

    applyCache(el, readCache());

    var tz = el.getAttribute("data-tz") || "Europe/Berlin";
    var start = parseInt(el.getAttribute("data-start") || "7", 10);
    var end = parseInt(el.getAttribute("data-end") || "21", 10);
    var location = el.getAttribute("data-location");
    var locationEl = el.querySelector(".availability__location");
    var timeEl = el.querySelector(".availability__time");
    var weatherEl = el.querySelector(".availability__weather");

    if (location && locationEl) locationEl.textContent = location;

    var timeFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    var hourFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    var dayFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
    });

    function update() {
      var now = new Date();
      var hour = parseInt(hourFmt.format(now), 10);
      if (hour === 24) hour = 0;
      var day = dayFmt.format(now);
      var isWeekend = day === "Sat" || day === "Sun";
      var available = !isWeekend && hour >= start && hour < end;
      var state = isWeekend ? "weekend" : available ? "available" : "away";
      var statusLabel = isWeekend
        ? "Off for the weekend"
        : available
          ? "Available now"
          : "Away";

      el.setAttribute("data-available", available ? "true" : "false");
      el.setAttribute("data-state", state);
      if (timeEl) timeEl.textContent = timeFmt.format(now);

      var locationLabel = location || "Local time";
      el.setAttribute(
        "title",
        locationLabel + " · " + timeFmt.format(now) + " · " + statusLabel
      );
      el.setAttribute(
        "aria-label",
        locationLabel +
          ", " +
          timeFmt.format(now) +
          ", " +
          statusLabel.toLowerCase()
      );

      writeCache(el);
    }

    update();
    var msToNextMinute = (60 - new Date().getSeconds()) * 1000;
    setTimeout(function () {
      update();
      setInterval(update, 60 * 1000);
    }, msToNextMinute);

    if (weatherEl) {
      fetchWeather(el, weatherEl);
      setInterval(function () {
        fetchWeather(el, weatherEl);
      }, WEATHER_REFRESH_MS);
    }
  }

  window.initAvailabilityWidgets = function () {
    document.querySelectorAll("[data-availability]").forEach(init);
  };

  window.initAvailabilityWidgets();
})();
