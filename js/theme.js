// theme.js — v0.18 dark mode. A plain (non-module) script loaded in <head> so the right colours
// show from the first frame. Setting (this device only): 'system' (default), 'light' or 'dark'.
(function () {
  var KEY = 'sparky.theme';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function pref() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function apply() {
    var p = pref(); var dark = p === 'dark' || (p === 'system' && !!(mq && mq.matches));
    document.documentElement.classList.toggle('dark', dark);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#141a2b' : '#1a2bd6');
  }
  window.sparkyTheme = { get: pref, set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} apply(); }, apply: apply };
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  apply();
})();
