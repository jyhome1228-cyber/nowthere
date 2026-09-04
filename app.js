(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STORAGE = {
    dashboard: 'nowthere.dashboard.v1',
    hour12: 'nowthere.hour12',
    theme: 'nowthere.theme'
  };

  const PRIMARY_ZONE_OVERRIDES = {
    AU: 'Australia/Sydney',
    BR: 'America/Sao_Paulo',
    CA: 'America/Toronto',
    CL: 'America/Santiago',
    CN: 'Asia/Shanghai',
    ES: 'Europe/Madrid',
    ID: 'Asia/Jakarta',
    KZ: 'Asia/Almaty',
    MX: 'America/Mexico_City',
    NZ: 'Pacific/Auckland',
    PT: 'Europe/Lisbon',
    RU: 'Europe/Moscow',
    UA: 'Europe/Kyiv',
    US: 'America/New_York'
  };

  const QUICK_LOCATIONS = [
    { code: 'KR', zone: 'Asia/Seoul' },
    { code: 'JP', zone: 'Asia/Tokyo' },
    { code: 'GB', zone: 'Europe/London' },
    { code: 'US', zone: 'America/New_York' },
    { code: 'FR', zone: 'Europe/Paris' },
    { code: 'AU', zone: 'Australia/Sydney' }
  ];

  const locale = navigator.language || 'en-US';
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const makeRegionNames = (targetLocale) => {
    try {
      return new Intl.DisplayNames([targetLocale], { type: 'region' });
    } catch (error) {
      return null;
    }
  };

  const localRegionNames = makeRegionNames(locale);
  const englishRegionNames = makeRegionNames('en');

  const countries = Object.entries(COUNTRY_TIMEZONES)
    .map(([code, zones]) => ({ code, zones }))
    .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code), locale));

  const locations = countries.flatMap((country) => country.zones.map((zone) => ({
    code: country.code,
    zone,
    city: zoneCity(zone),
    country: countryName(country.code),
    countryEnglish: englishCountryName(country.code)
  })));

  const localLocation = locations.find((item) => item.zone === localTimeZone);

  const state = {
    shiftHours: 0,
    hour12: localStorage.getItem(STORAGE.hour12) === 'true',
    dashboard: loadDashboard(),
    dragId: null
  };

  const globalSearch = $('#globalSearch');
  const searchResults = $('#searchResults');
  const quickGrid = $('#quickGrid');
  const dashboardGrid = $('#dashboardGrid');
  const timeShift = $('#timeShift');
  const shiftLabel = $('#shiftLabel');
  const resetShift = $('#resetShift');
  const hourToggle = $('#hourToggle');
  const themeToggle = $('#themeToggle');
  const countryFilter = $('#countryFilter');
  const worldGrid = $('#worldGrid');
  const worldCount = $('#worldCount');

  initTheme();
  renderQuickLocations();
  renderDashboard();
  renderWorld();
  updateHourToggle();
  updateShiftUI();
  updateAllClocks();
  bindEvents();

  window.setInterval(() => {
    updateQuickClocks();
    updateDashboardClocks();
  }, 1000);

  window.setInterval(() => {
    updateWorldClocks();
    if (!searchResults.hidden && globalSearch.value.trim()) renderSearchResults(globalSearch.value);
  }, 60000);

  function countryName(code) {
    try {
      return localRegionNames?.of(code) || englishRegionNames?.of(code) || code;
    } catch (error) {
      return code;
    }
  }

  function englishCountryName(code) {
    try {
      return englishRegionNames?.of(code) || code;
    } catch (error) {
      return code;
    }
  }

  function flagEmoji(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '◉';
    return [...code].map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397)).join('');
  }

  function zoneCity(zone) {
    const parts = zone.split('/');
    return (parts[parts.length - 1] || zone).replaceAll('_', ' ');
  }

  function getPrimaryZone(code, zones) {
    const preferred = PRIMARY_ZONE_OVERRIDES[code];
    return preferred && zones.includes(preferred) ? preferred : zones[0];
  }

  function nowWithShift() {
    return new Date(Date.now() + state.shiftHours * 60 * 60 * 1000);
  }

  function getZonedParts(zone, date = nowWithShift()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    return Object.fromEntries(
      formatter.formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
  }

  function formatTime(zone, date = nowWithShift(), includeSeconds = false) {
    const options = {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: state.hour12
    };

    if (includeSeconds) options.second = '2-digit';
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  function formatDate(zone, date = nowWithShift()) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function getStatus(zone, date = nowWithShift()) {
    const parts = getZonedParts(zone, date);
    const hour = Number(parts.hour);

    if (parts.weekday === 'Sat' || parts.weekday === 'Sun') {
      return { label: 'WEEKEND', tone: 'sleeping' };
    }
    if (hour < 6) return { label: 'SLEEPING', tone: 'sleeping' };
    if (hour < 9) return { label: 'EARLY MORNING', tone: 'warning' };
    if (hour < 12) return { label: 'WORKING', tone: 'working' };
    if (hour < 13) return { label: 'LUNCH TIME', tone: 'warning' };
    if (hour < 18) return { label: 'WORKING', tone: 'working' };
    if (hour < 22) return { label: 'AFTER HOURS', tone: 'warning' };
    return { label: 'NIGHT', tone: 'sleeping' };
  }

  function getOffsetMinutes(zone, date = nowWithShift()) {
    const parts = getZonedParts(zone, date);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  }

  function formatDuration(minutes) {
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    if (!mins) return `${hours}H`;
    if (!hours) return `${mins}M`;
    return `${hours}H ${mins}M`;
  }

  function differenceLabel(zone, date = nowWithShift()) {
    const diff = getOffsetMinutes(zone, date) - getOffsetMinutes(localTimeZone, date);
    if (diff === 0) return 'SAME TIME AS YOU';
    return `${formatDuration(diff)} ${diff > 0 ? 'AHEAD OF YOU' : 'BEHIND YOU'}`;
  }

  function worklinePosition(zone, date = nowWithShift()) {
    const parts = getZonedParts(zone, date);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    return Math.min(100, Math.max(0, ((hour + minute / 60) / 24) * 100));
  }

  function quickCardMarkup(item) {
    const name = countryName(item.code);
    const status = getStatus(item.zone);
    return `
      <button class="quick-card" type="button" data-zone="${item.zone}" data-code="${item.code}" aria-label="Add ${zoneCity(item.zone)}, ${name} to dashboard">
        <span class="card-topline">
          <span class="city-label">
            <strong>${zoneCity(item.zone)}</strong>
            <span>${name}</span>
          </span>
          <span class="flag" aria-hidden="true">${flagEmoji(item.code)}</span>
        </span>
        <span class="quick-time js-quick-time">${formatTime(item.zone)}</span>
        <span class="status-row js-quick-status" data-status-tone="${status.tone}">
          <span class="status-dot"></span>${status.label}
        </span>
      </button>`;
  }

  function renderQuickLocations() {
    quickGrid.innerHTML = QUICK_LOCATIONS.map(quickCardMarkup).join('');
  }

  function renderDashboard() {
    if (!state.dashboard.length) {
      dashboardGrid.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>Build your world.</strong>
            <span>Search a country or city above, then add it to your dashboard.</span>
          </div>
        </div>`;
      return;
    }

    dashboardGrid.innerHTML = state.dashboard.map((item) => dashboardCardMarkup(item)).join('');
    updateDashboardClocks();
  }

  function dashboardCardMarkup(item) {
    const city = zoneCity(item.zone);
    const country = countryName(item.code);
    const status = getStatus(item.zone);
    return `
      <article class="time-card" draggable="true" data-id="${item.id}" data-zone="${item.zone}" data-code="${item.code}" data-size="${item.size}">
        <div class="time-card-top">
          <div class="city-label">
            <strong>${city}</strong>
            <span>${country} · ${item.zone}</span>
          </div>
          <div class="card-actions">
            <button class="card-action" type="button" data-action="size" aria-label="Change ${city} card size">${item.size.toUpperCase()}</button>
            <button class="card-action" type="button" data-action="remove" aria-label="Remove ${city}">×</button>
          </div>
        </div>

        <div class="time-card-main">
          <div class="time-card-time js-card-time">${formatTime(item.zone, nowWithShift(), item.size === 'l')}</div>
          <div class="time-card-date js-card-date">${formatDate(item.zone)}</div>
          <div class="workline" aria-hidden="true">
            <div class="workline-track">
              <span class="workline-hours"></span>
              <span class="workline-now js-workline-now" style="left:${worklinePosition(item.zone)}%"></span>
            </div>
            <div class="workline-labels"><span>00</span><span>09 WORK</span><span>18</span><span>24</span></div>
          </div>
        </div>

        <div class="time-card-footer">
          <div class="status-row js-card-status" data-status-tone="${status.tone}">
            <span class="status-dot"></span>${status.label}
          </div>
          <div class="time-difference js-card-diff">${differenceLabel(item.zone)}</div>
        </div>
      </article>`;
  }

  function renderWorld(filter = countryFilter.value.trim()) {
    const query = normalize(filter);
    const filtered = countries.filter((item) => {
      if (!query) return true;
      return [countryName(item.code), englishCountryName(item.code), item.code]
        .some((value) => normalize(value).includes(query));
    });

    worldGrid.innerHTML = filtered.map((item) => {
      const zone = getPrimaryZone(item.code, item.zones);
      const status = getStatus(zone);
      const extraZones = item.zones.length > 1 ? ` · ${item.zones.length} time zones` : '';
      return `
        <article class="world-card" data-zone="${zone}" data-code="${item.code}">
          <div class="world-card-top">
            <div class="world-country">
              <strong>${countryName(item.code)}</strong>
              <span>${zoneCity(zone)}${extraZones}</span>
            </div>
            <span class="flag" aria-hidden="true">${flagEmoji(item.code)}</span>
          </div>
          <div class="world-card-time js-world-time">${formatTime(zone)}</div>
          <div class="status-row js-world-status" data-status-tone="${status.tone}">
            <span class="status-dot"></span>${status.label}
          </div>
          <div class="world-card-meta">
            <span class="zone-note">${zone}</span>
            <button class="add-world" type="button" data-add-zone="${zone}" data-add-code="${item.code}" aria-label="Add ${countryName(item.code)} to dashboard">+</button>
          </div>
        </article>`;
    }).join('');

    worldCount.textContent = `${filtered.length} / ${countries.length} countries & regions`;
  }

  function normalize(value) {
    return String(value || '').toLocaleLowerCase(locale).replace(/[._/-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function scoreLocation(item, query) {
    const q = normalize(query);
    const city = normalize(item.city);
    const country = normalize(item.country);
    const countryEnglish = normalize(item.countryEnglish);
    const zone = normalize(item.zone);
    const code = normalize(item.code);

    if (city === q) return 120;
    if (country === q || countryEnglish === q || code === q) return 110;
    if (city.startsWith(q)) return 100;
    if (country.startsWith(q) || countryEnglish.startsWith(q)) return 90;
    if (city.includes(q)) return 80;
    if (country.includes(q) || countryEnglish.includes(q)) return 70;
    if (zone.includes(q)) return 60;
    return -1;
  }

  function renderSearchResults(query) {
    const q = query.trim();
    if (!q) {
      searchResults.hidden = true;
      searchResults.innerHTML = '';
      return;
    }

    const results = locations
      .map((item) => ({ item, score: scoreLocation(item, q) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.city.localeCompare(b.item.city, locale))
      .slice(0, 14)
      .map(({ item }) => item);

    if (!results.length) {
      searchResults.innerHTML = `<div class="search-result" aria-disabled="true"><span></span><span class="result-copy"><strong class="result-city">No matching place</strong><span class="result-country">Try a country, city or IANA timezone.</span></span><span></span></div>`;
      searchResults.hidden = false;
      return;
    }

    searchResults.innerHTML = results.map((item) => `
      <button class="search-result" type="button" data-search-zone="${item.zone}" data-search-code="${item.code}">
        <span class="flag" aria-hidden="true">${flagEmoji(item.code)}</span>
        <span class="result-copy">
          <strong class="result-city">${item.city}</strong>
          <span class="result-country">${item.country} · ${item.zone}</span>
        </span>
        <span class="result-time">${formatTime(item.zone)}</span>
      </button>`).join('');
    searchResults.hidden = false;
  }

  function loadDashboard() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.dashboard));
      if (Array.isArray(saved)) {
        return saved.filter((item) => item && item.zone && item.code).map((item) => ({
          id: item.id || makeId(item.code, item.zone),
          code: item.code,
          zone: item.zone,
          size: ['s', 'm', 'l'].includes(item.size) ? item.size : 'm'
        }));
      }
    } catch (error) {
      // Fall through to defaults.
    }

    const defaults = [];
    if (localLocation) {
      defaults.push({ id: makeId(localLocation.code, localLocation.zone), code: localLocation.code, zone: localLocation.zone, size: 'l' });
    }

    [
      { code: 'GB', zone: 'Europe/London' },
      { code: 'US', zone: 'America/New_York' },
      { code: 'JP', zone: 'Asia/Tokyo' }
    ].forEach((item) => {
      if (!defaults.some((saved) => saved.zone === item.zone)) {
        defaults.push({ ...item, id: makeId(item.code, item.zone), size: 'm' });
      }
    });
    return defaults;
  }

  function makeId(code, zone) {
    return `${code}|${zone}`;
  }

  function saveDashboard() {
    localStorage.setItem(STORAGE.dashboard, JSON.stringify(state.dashboard));
  }

  function addDashboardLocation(code, zone) {
    const id = makeId(code, zone);
    const existing = state.dashboard.find((item) => item.id === id);
    if (!existing) {
      state.dashboard.push({ id, code, zone, size: 'm' });
      saveDashboard();
      renderDashboard();
    }
    searchResults.hidden = true;
    globalSearch.value = '';
    $('#dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cycleCardSize(id) {
    const sizes = ['s', 'm', 'l'];
    const item = state.dashboard.find((entry) => entry.id === id);
    if (!item) return;
    item.size = sizes[(sizes.indexOf(item.size) + 1) % sizes.length];
    saveDashboard();
    renderDashboard();
  }

  function removeDashboardLocation(id) {
    state.dashboard = state.dashboard.filter((item) => item.id !== id);
    saveDashboard();
    renderDashboard();
  }

  function reorderDashboard(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const fromIndex = state.dashboard.findIndex((item) => item.id === sourceId);
    const toIndex = state.dashboard.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = state.dashboard.splice(fromIndex, 1);
    state.dashboard.splice(toIndex, 0, moved);
    saveDashboard();
    renderDashboard();
  }

  function updateQuickClocks() {
    $$('.quick-card', quickGrid).forEach((card) => {
      const zone = card.dataset.zone;
      const status = getStatus(zone);
      $('.js-quick-time', card).textContent = formatTime(zone);
      const statusEl = $('.js-quick-status', card);
      statusEl.dataset.statusTone = status.tone;
      statusEl.lastChild.textContent = status.label;
    });
  }

  function updateDashboardClocks() {
    $$('.time-card', dashboardGrid).forEach((card) => {
      const zone = card.dataset.zone;
      const size = card.dataset.size;
      const status = getStatus(zone);
      $('.js-card-time', card).textContent = formatTime(zone, nowWithShift(), size === 'l');
      $('.js-card-date', card).textContent = formatDate(zone);
      $('.js-card-diff', card).textContent = differenceLabel(zone);
      const statusEl = $('.js-card-status', card);
      statusEl.dataset.statusTone = status.tone;
      statusEl.lastChild.textContent = status.label;
      const marker = $('.js-workline-now', card);
      if (marker) marker.style.left = `${worklinePosition(zone)}%`;
    });
  }

  function updateWorldClocks() {
    $$('.world-card', worldGrid).forEach((card) => {
      const zone = card.dataset.zone;
      const status = getStatus(zone);
      $('.js-world-time', card).textContent = formatTime(zone);
      const statusEl = $('.js-world-status', card);
      statusEl.dataset.statusTone = status.tone;
      statusEl.lastChild.textContent = status.label;
    });
  }

  function updateAllClocks() {
    updateQuickClocks();
    updateDashboardClocks();
    updateWorldClocks();
  }

  function updateHourToggle() {
    hourToggle.textContent = state.hour12 ? '12H' : '24H';
    hourToggle.setAttribute('aria-pressed', String(state.hour12));
  }

  function updateShiftUI() {
    shiftLabel.textContent = state.shiftHours === 0 ? 'NOW' : `${state.shiftHours > 0 ? '+' : ''}${state.shiftHours}H`;
    resetShift.disabled = state.shiftHours === 0;
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE.theme);
    document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
    updateThemeButton();
  }

  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.textContent = dark ? '☼' : '◐';
    themeToggle.setAttribute('aria-pressed', String(dark));
  }

  function bindEvents() {
    globalSearch.addEventListener('input', (event) => renderSearchResults(event.target.value));
    globalSearch.addEventListener('focus', () => {
      if (globalSearch.value.trim()) renderSearchResults(globalSearch.value);
    });

    searchResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-search-zone]');
      if (!button) return;
      addDashboardLocation(button.dataset.searchCode, button.dataset.searchZone);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search-wrap')) searchResults.hidden = true;
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        globalSearch.focus();
      }
      if (event.key === 'Escape') searchResults.hidden = true;
    });

    quickGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.quick-card');
      if (!card) return;
      addDashboardLocation(card.dataset.code, card.dataset.zone);
    });

    dashboardGrid.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      const card = event.target.closest('.time-card');
      if (!action || !card) return;
      if (action.dataset.action === 'size') cycleCardSize(card.dataset.id);
      if (action.dataset.action === 'remove') removeDashboardLocation(card.dataset.id);
    });

    dashboardGrid.addEventListener('dragstart', (event) => {
      const card = event.target.closest('.time-card');
      if (!card) return;
      state.dragId = card.dataset.id;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', state.dragId);
    });

    dashboardGrid.addEventListener('dragover', (event) => {
      const card = event.target.closest('.time-card');
      if (!card) return;
      event.preventDefault();
      $$('.drag-over', dashboardGrid).forEach((item) => item.classList.remove('drag-over'));
      if (card.dataset.id !== state.dragId) card.classList.add('drag-over');
    });

    dashboardGrid.addEventListener('drop', (event) => {
      const card = event.target.closest('.time-card');
      if (!card) return;
      event.preventDefault();
      reorderDashboard(state.dragId || event.dataTransfer.getData('text/plain'), card.dataset.id);
      state.dragId = null;
    });

    dashboardGrid.addEventListener('dragend', () => {
      state.dragId = null;
      $$('.time-card', dashboardGrid).forEach((card) => card.classList.remove('dragging', 'drag-over'));
    });

    timeShift.addEventListener('input', (event) => {
      state.shiftHours = Number(event.target.value) || 0;
      updateShiftUI();
      updateAllClocks();
      if (!searchResults.hidden && globalSearch.value.trim()) renderSearchResults(globalSearch.value);
    });

    resetShift.addEventListener('click', () => {
      state.shiftHours = 0;
      timeShift.value = '0';
      updateShiftUI();
      updateAllClocks();
    });

    hourToggle.addEventListener('click', () => {
      state.hour12 = !state.hour12;
      localStorage.setItem(STORAGE.hour12, String(state.hour12));
      updateHourToggle();
      updateAllClocks();
      if (!searchResults.hidden && globalSearch.value.trim()) renderSearchResults(globalSearch.value);
    });

    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(STORAGE.theme, next);
      updateThemeButton();
    });

    countryFilter.addEventListener('input', () => renderWorld(countryFilter.value));

    worldGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-zone]');
      if (!button) return;
      addDashboardLocation(button.dataset.addCode, button.dataset.addZone);
    });
  }
})();
