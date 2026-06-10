/* SmartTips no-FOUC theme initializer.
   Loaded synchronously in <head> before any paint, sets data-theme on <html>
   based on the persisted preference (or system preference if not set).
   The values read from localStorage are validated against a hardcoded
   whitelist before being applied, so a tampered storage value cannot inject
   arbitrary content. */
(function () {
  try {
    var key = 'smarttips:theme';
    var stored = null;
    try {
      stored = window.localStorage.getItem(key);
    } catch (_) {
      // Storage unavailable (Safari private mode, sandboxed iframe) — degrade.
    }
    var pref = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved = pref;
    if (pref === 'system') {
      var mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
      resolved = mql && mql.matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', pref);
    // Suspend transitions until first paint settles so the swap is instant.
    root.classList.add('st-no-transition');
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.classList.remove('st-no-transition');
      });
    });
  } catch (_) {
    // Silent — fall back to CSS default (dark) rather than break the page.
  }
})();
