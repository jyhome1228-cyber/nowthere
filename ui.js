(() => {
  'use strict';

  const zoneLabel = document.querySelector('#localZoneLabel');
  const localClock = document.querySelector('#localClock');
  const localStatus = document.querySelector('#localStatus');
  if (!zoneLabel || !localClock || !localStatus) return;

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const locale = navigator.language || 'en-US';

  const readableZone = zone
    .split('/')
    .pop()
    .replaceAll('_', ' ');

  zoneLabel.textContent = `${readableZone} · ${zone}`;

  const getStatus = (date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        weekday: 'short',
        hour: '2-digit',
        hourCycle: 'h23'
      })
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );

    const hour = Number(parts.hour);
    if (parts.weekday === 'Sat' || parts.weekday === 'Sun') return 'WEEKEND';
    if (hour < 6) return 'SLEEPING';
    if (hour < 9) return 'EARLY MORNING';
    if (hour < 12) return 'WORKING';
    if (hour < 13) return 'LUNCH TIME';
    if (hour < 18) return 'WORKING';
    if (hour < 22) return 'AFTER HOURS';
    return 'NIGHT';
  };

  const update = () => {
    const now = new Date();
    localClock.textContent = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    localStatus.textContent = getStatus(now);
  };

  update();
  window.setInterval(update, 1000);
})();
