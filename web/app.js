(function () {
  "use strict";

  const POSTS_PER_PAGE = 10;
  const SEO_INITIAL_COUNT = 12;

  // ── Pagination state ──────────────────────────────────
  let _paginationState = null;

  function initPagination(section, allItems, renderFn) {
    teardownPagination();
    _paginationState = {
      section,
      sort: "latest",
      allItems,
      filteredItems: [...allItems],
      renderFn,
      currentIndex: 0,
      itemsPerPage: SEO_INITIAL_COUNT,
      searchQuery: "",
      observer: null,
    };
  }

  function teardownPagination() {
    if (_paginationState && _paginationState.observer) {
      _paginationState.observer.disconnect();
      _paginationState.observer = null;
    }
    _paginationState = null;
  }

  function getSortedItems(items, sort) {
    const arr = [...items];
    switch (sort) {
      case "oldest": return arr.sort((a, b) => new Date(a.date) - new Date(b.date));
      case "az":     return arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      case "za":     return arr.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      default:       return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
  }

  function computeItemsPerPage() {
    const card = document.querySelector("#paginated-list > *");
    if (!card) return SEO_INITIAL_COUNT;
    const h = card.getBoundingClientRect().height;
    return h > 0 ? Math.max(6, Math.min(24, Math.floor(window.innerHeight / h))) : SEO_INITIAL_COUNT;
  }

  function setupPaginationSentinel() {
    const pageContent = document.getElementById("page-content");
    if (!pageContent || !_paginationState) return;
    const sentinel = document.createElement("div");
    sentinel.id = "pagination-sentinel";
    pageContent.appendChild(sentinel);
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) appendPaginatedItems(); },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    _paginationState.observer = observer;
  }

  function appendPaginatedItems() {
    if (!_paginationState) return;
    const { filteredItems, currentIndex, itemsPerPage, renderFn } = _paginationState;
    const chunk = filteredItems.slice(currentIndex, currentIndex + itemsPerPage);
    if (!chunk.length) { detachPaginationObserver(); return; }
    const list = document.getElementById("paginated-list");
    if (list) {
      list.insertAdjacentHTML("beforeend", chunk.map(renderFn).join(""));
      initLazyImages();
    }
    _paginationState.currentIndex += chunk.length;
    if (_paginationState.currentIndex >= filteredItems.length) detachPaginationObserver();
  }

  function detachPaginationObserver() {
    if (!_paginationState) return;
    if (_paginationState.observer) {
      _paginationState.observer.disconnect();
      _paginationState.observer = null;
    }
    const s = document.getElementById("pagination-sentinel");
    if (s) s.remove();
  }

  function refreshPaginatedList() {
    if (!_paginationState) return;
    detachPaginationObserver();
    const list = document.getElementById("paginated-list");
    if (!list) return;
    _paginationState.currentIndex = 0;
    const initial = _paginationState.filteredItems.slice(0, _paginationState.itemsPerPage);
    _paginationState.currentIndex = initial.length;
    list.innerHTML =
      initial.map(_paginationState.renderFn).join("") ||
      '<div class="empty-state"><p>No results.</p></div>';
    initLazyImages();
    if (_paginationState.currentIndex < _paginationState.filteredItems.length) {
      setupPaginationSentinel();
    }
  }

  function initDirControls(allItems, options = {}) {
    const searchInput = document.getElementById("dir-search");
    const sortSelect = document.getElementById("dir-sort");
    const sortWrap = document.querySelector(".dir-sort-wrap");
    if (!searchInput || !sortSelect || !_paginationState) return;
    const onQueryChange =
      options && typeof options.onQueryChange === "function"
        ? options.onQueryChange
        : null;
    let debounce;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        _paginationState.searchQuery = q;
        if (onQueryChange) onQueryChange(q);
        if (q) {
          if (sortWrap) sortWrap.style.display = "none";
          _paginationState.filteredItems = allItems.filter(
            (item) =>
              (item.title || "").toLowerCase().includes(q) ||
              (item.dir || "").toLowerCase().includes(q) ||
              (item.summary || "").toLowerCase().includes(q),
          );
        } else {
          if (sortWrap) sortWrap.style.display = "";
          _paginationState.filteredItems = getSortedItems(allItems, _paginationState.sort);
        }
        refreshPaginatedList();
      }, 200);
    });
    sortSelect.addEventListener("change", (e) => {
      _paginationState.sort = e.target.value;
      _paginationState.filteredItems = getSortedItems(allItems, e.target.value);
      refreshPaginatedList();
    });
  }

  function initMoreDirsButton() {
    const btn = document.getElementById("more-dirs-btn");
    const hidden = document.getElementById("blog-dir-hidden");
    if (!btn || !hidden) return;
    btn.addEventListener("click", () => {
      hidden.hidden = false;
      btn.remove();
    });
  }

  function dirControlsHtml() {
    return `<div class="dir-controls">
      <div class="dir-search-wrap">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <input id="dir-search" class="dir-search-input" type="search" placeholder="Search here\u2026" aria-label="Search current listing">
      </div>
      <div class="dir-sort-wrap">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 3v9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 10.5L5 12.5L7 10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 13V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9 5.5L11 3.5L13 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <select id="dir-sort" class="dir-sort-select" aria-label="Sort listing">
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="az">A \u2192 Z</option>
          <option value="za">Z \u2192 A</option>
        </select>
      </div>
    </div>`;
  }

  const state = {
    posts: [],
    portfolio: [],
    gallery: [],
    thoughts: [],
    pages: [],
    tags: {},
    categories: {},
    blogDirs: {},
    searchIndex: null,
    searchIndexPromise: null,
    miniSearch: null,
    config: window.__RAKSARA_SITE_CONFIG__ || {},
    imageManifest: {},
    imageManifestPromise: null,
    loaded: false,
  };
  const runtime = {
    basePath: "",
  };
  const highlightState = {
    corePromise: null,
    instance: null,
    loadedLangs: new Set(),
  };
  const vendorState = {
    markdownPromise: null,
    searchPromise: null,
  };
  // Per-section lazy-load promises: keyed by section name, resolved when data is in state
  const _sectionPromises = {};
  const adsenseState = {
    scriptPromise: null,
    bootstrapped: false,
    observer: null,
    intentHandler: null,
    idleTimer: null,
    idleHandle: null,
  };
  const HIGHLIGHT_LANG_ALIASES = {
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    md: "markdown",
    html: "xml",
    xhtml: "xml",
    plist: "xml",
    text: "plaintext",
    txt: "plaintext",
    plain: "plaintext",
    log: "plaintext",
  };

  function toAssetHref(pathname) {
    const normalized = String(pathname || "").replace(/^\/+/, "");
    if (!normalized) return runtime.basePath || "/";
    // Static asset paths (files with an extension such as .json, .js, .css,
    // .md, .webp …) must be fetched without a trailing slash — a trailing slash
    // produces a 404 because the server has no directory at that address.
    // Extension-less paths are page routes: delegate to toRouteHref so that
    // GitHub Pages receives the trailing slash it needs to serve pre-built
    // index.html files directly without issuing a 301 redirect.
    if (/\.[^/]+$/.test(normalized)) {
      return `${runtime.basePath}/${normalized}`;
    }
    return toRouteHref(`/${normalized}`);
  }

  function normalizeHighlightLanguage(lang) {
    if (!lang) return "plaintext";
    const normalized = String(lang).trim().toLowerCase();
    return HIGHLIGHT_LANG_ALIASES[normalized] || normalized;
  }

  function loadScriptOnce(src, key) {
    if (vendorState[key]) return vendorState[key];
    vendorState[key] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
    return vendorState[key];
  }

  function extractAdsenseAccountId(rawValue) {
    if (!rawValue) return "";
    const match = String(rawValue).match(/pub-\d{6,}/i);
    if (!match) return "";
    const accountId = match[0].toLowerCase();
    // Ignore placeholder values like pub-0000000000000000.
    if (/^pub-0+$/.test(accountId)) return "";
    return accountId;
  }

  function getConfiguredAdsenseRaw() {
    if (!state || !state.config || typeof state.config !== "object") return "";
    if (!Object.prototype.hasOwnProperty.call(state.config, "adsense")) return "";
    const raw = state.config.adsense;
    if (typeof raw === "string") return raw.trim();
    if (Array.isArray(raw)) return raw.map((entry) => String(entry || "").trim()).join(", ");
    if (raw && typeof raw === "object") {
      const domain = raw.domain || raw.network || raw.host || "";
      const publisher = raw.publisher || raw.pub || raw.account || raw.publisher_id || raw.publisherId || "";
      const relationship = raw.relationship || raw.type || raw.account_type || "";
      const cert = raw.cert || raw.cert_id || raw.certification || raw.caid || "";
      return [domain, publisher, relationship, cert]
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .join(", ");
    }
    return String(raw || "").trim();
  }

  function getAdsenseAccountId() {
    const raw = getConfiguredAdsenseRaw();
    return extractAdsenseAccountId(raw);
  }

  function teardownAdsenseBootstrap() {
    if (adsenseState.observer) {
      adsenseState.observer.disconnect();
      adsenseState.observer = null;
    }
    if (adsenseState.intentHandler) {
      window.removeEventListener("pointerdown", adsenseState.intentHandler, true);
      window.removeEventListener("scroll", adsenseState.intentHandler, true);
      window.removeEventListener("keydown", adsenseState.intentHandler, true);
      adsenseState.intentHandler = null;
    }
    if (adsenseState.idleHandle && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(adsenseState.idleHandle);
      adsenseState.idleHandle = null;
    }
    if (adsenseState.idleTimer) {
      clearTimeout(adsenseState.idleTimer);
      adsenseState.idleTimer = null;
    }
  }

  function hasAdsenseSlots(root = document) {
    return Boolean(root.querySelector("ins.adsbygoogle"));
  }

  function hydrateAdsenseSlots() {
    if (typeof window.adsbygoogle === "undefined") return;
    document.querySelectorAll("ins.adsbygoogle").forEach((slot) => {
      if (slot.dataset.adsbygoogleStatus) return;
      try {
        window.adsbygoogle.push({});
      } catch {
        // Ignore per-slot init errors and continue.
      }
    });
  }

  async function ensureAdsenseScriptLoaded(accountId) {
    if (adsenseState.scriptPromise) return adsenseState.scriptPromise;
    if (!accountId) return Promise.resolve();

    adsenseState.scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${accountId}`;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load AdSense script"));
      document.head.appendChild(script);
    });

    return adsenseState.scriptPromise;
  }

  function scheduleAdsenseBootstrap() {
    teardownAdsenseBootstrap();
    adsenseState.bootstrapped = false;

    const accountId = getAdsenseAccountId();
    if (!accountId) return;
    if (!hasAdsenseSlots()) return;

    const bootstrap = async () => {
      if (adsenseState.bootstrapped) return;
      adsenseState.bootstrapped = true;
      try {
        await ensureAdsenseScriptLoaded(accountId);
        hydrateAdsenseSlots();
      } catch (err) {
        console.warn("AdSense bootstrap skipped:", err && err.message ? err.message : err);
      }
    };

    const firstSlot = document.querySelector("ins.adsbygoogle");
    if (firstSlot && "IntersectionObserver" in window) {
      adsenseState.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          if (adsenseState.observer) {
            adsenseState.observer.disconnect();
            adsenseState.observer = null;
          }
          bootstrap();
        },
        { rootMargin: "300px 0px" },
      );
      adsenseState.observer.observe(firstSlot);
    }

    const onFirstIntent = () => {
      teardownAdsenseBootstrap();
      bootstrap();
    };
    adsenseState.intentHandler = onFirstIntent;
    window.addEventListener("pointerdown", onFirstIntent, true);
    window.addEventListener("scroll", onFirstIntent, true);
    window.addEventListener("keydown", onFirstIntent, true);

    if ("requestIdleCallback" in window) {
      adsenseState.idleHandle = window.requestIdleCallback(() => {
        adsenseState.idleHandle = null;
        bootstrap();
      }, { timeout: 4000 });
    } else {
      adsenseState.idleTimer = setTimeout(() => {
        adsenseState.idleTimer = null;
        bootstrap();
      }, 2500);
    }
  }

  async function ensureImageManifest() {
    if (state.imageManifestPromise) {
      await state.imageManifestPromise;
      return;
    }
    state.imageManifestPromise = loadJSON("metadata/image-manifest.json")
      .then((manifest) => { state.imageManifest = manifest; })
      .catch(() => {});
    await state.imageManifestPromise;
  }

  // Lazy-load a single data section on first demand; subsequent calls await the same promise.
  async function ensureSection(section) {
    if (_sectionPromises[section]) {
      await _sectionPromises[section];
      return;
    }
    const urls = {
      posts: "metadata/posts.json",
      portfolio: "metadata/portfolio.json",
      gallery: "metadata/gallery.json",
      thoughts: "metadata/thoughts.json",
      pages: "metadata/pages.json",
      docs: "metadata/docs.json",
      tags: "metadata/tags.json",
      categories: "metadata/categories.json",
      blogDirs: "metadata/blog-dirs.json",
    };
    const url = urls[section];
    if (!url) return;
    _sectionPromises[section] = loadJSON(url)
      .then((data) => { state[section] = data; })
      .catch(() => {});
    await _sectionPromises[section];
  }

  // Background-prefetch all sections during idle time after first render.
  function prefetchAllSections() {
    const schedule = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
      : (fn) => setTimeout(fn, 500);
    schedule(() => {
      ["posts", "portfolio", "gallery", "thoughts", "pages", "docs", "tags", "categories", "blogDirs"]
        .forEach((s) => ensureSection(s));
      // Warm up routes chunk during idle to reduce first navigation latency.
      ensureRoutesBundleLoaded();
    });
  }

  async function ensureMarkdownVendorLoaded() {
    if (typeof marked !== "undefined") return;
    await loadScriptOnce(toAssetHref("vendor-markdown.min.js"), "markdownPromise");
  }

  async function ensureRoutesBundleLoaded() {
    if (window.__RAKSARA_ROUTES__) return;
    const coreScript = document.querySelector('script[src*="app.min.js"]');
    let version = "";
    if (coreScript && coreScript.src) {
      try {
        const parsed = new URL(coreScript.src, window.location.href);
        version = parsed.searchParams.get("v") || "";
      } catch (_) {
        version = "";
      }
    }
    const routesPath = version
      ? `app-routes.min.js?v=${encodeURIComponent(version)}`
      : "app-routes.min.js";
    await loadScriptOnce(toAssetHref(routesPath), "routesBundlePromise");
  }

  async function ensureSearchVendorLoaded() {
    if (typeof window.MiniSearch !== "undefined") return;
    await loadScriptOnce(toAssetHref("vendor-search.min.js"), "searchPromise");
    if (typeof window.MiniSearch === "undefined") {
      throw new Error("MiniSearch vendor loaded but MiniSearch is unavailable");
    }
  }

  async function ensureMiniSearchReady() {
    if (state.miniSearch) return;
    // Start the search-index fetch on first demand (not at page load)
    if (!state.searchIndexPromise) {
      state.searchIndexPromise = loadJSON("metadata/search-index.json")
        .then((idx) => { state.searchIndex = idx; })
        .catch(() => {});
    }
    // Wait for deferred background fetch of search index if in progress
    if (!state.searchIndex && state.searchIndexPromise) {
      await state.searchIndexPromise;
    }
    if (!state.searchIndex) return;
    await ensureSearchVendorLoaded();
    if (typeof window.MiniSearch === "undefined") return;
    state.miniSearch = window.MiniSearch.loadJS(state.searchIndex, {
      fields: ["title", "tags", "category", "body"],
      storeFields: ["title", "section", "slug", "category"],
    });
  }

  function getConfiguredAccentColor(config) {
    if (!config || typeof config !== "object") return "purple";
    return (
      config.color ||
      config.color_tone ||
      config.colorTone ||
      config.accent ||
      config.accent_color ||
      config.accentColor ||
      "purple"
    );
  }

  async function ensureHighlightCoreLoaded() {
    if (highlightState.instance) return highlightState.instance;
    if (!highlightState.corePromise) {
      // Try local vendor bundle first (built from node_modules by the build script).
      // vendor/hljs/es/core.js is a CJS re-export stub that fails in native browser ESM,
      // so we ship a proper browser IIFE at vendor-highlight.min.js instead.
      // Fall back to CDN if the local file is absent (e.g. fresh checkout before build).
      const localUrl = toAssetHref("vendor-highlight.min.js");
      const cdnUrl = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js";
      highlightState.corePromise = loadScriptOnce(localUrl, "highlightLocalPromise")
        .catch(() => loadScriptOnce(cdnUrl, "highlightLegacyPromise"))
        .then(() => {
          const instance = window.hljs;
          if (!instance) throw new Error("Highlight core failed to initialize");
          highlightState.instance = instance;
          return instance;
        });
    }
    return highlightState.corePromise;
  }

  async function ensureHighlightLanguageLoaded(rawLang) {
    const language = normalizeHighlightLanguage(rawLang);
    if (!language || highlightState.loadedLangs.has(language)) return;

    const hljs = await ensureHighlightCoreLoaded();
    if (hljs.getLanguage(language)) {
      highlightState.loadedLangs.add(language);
      return;
    }

    try {
      const langUrl = toAssetHref(`vendor/hljs/es/languages/${language}.js`);
      const mod = await import(langUrl);
      const def = mod.default || mod;
      if (typeof def === "function") {
        hljs.registerLanguage(language, def);
        highlightState.loadedLangs.add(language);
      }
    } catch {
      if (!highlightState.loadedLangs.has("plaintext")) {
        try {
          const plainUrl = toAssetHref("vendor/hljs/es/languages/plaintext.js");
          const plainMod = await import(plainUrl);
          const plainDef = plainMod.default || plainMod;
          if (typeof plainDef === "function") {
            hljs.registerLanguage("plaintext", plainDef);
            highlightState.loadedLangs.add("plaintext");
          }
        } catch {
          // keep unhighlighted fallback
        }
      }
    }
  }

  function normalizeRoutePath(route) {
    if (!route) return "/";
    const clean = String(route)
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^[#]+/, "")
      .replace(/\/index\.html$/i, "")
      .replace(/\/+$/, "");
    if (!clean || clean === "/") return "/";
    return clean.startsWith("/") ? clean : `/${clean}`;
  }

  function initBasePath() {
    try {
      const p = new URL(document.baseURI).pathname || "/";
      runtime.basePath = p === "/" ? "" : p.replace(/\/$/, "");
    } catch {
      runtime.basePath = "";
    }
  }

  function stripBasePath(pathname) {
    if (!runtime.basePath || runtime.basePath === "/") return pathname;
    if (pathname.startsWith(runtime.basePath + "/")) {
      return pathname.slice(runtime.basePath.length);
    }
    if (pathname === runtime.basePath) return "/";
    return pathname;
  }

  function toRouteHref(route) {
    const normalized = normalizeRoutePath(route);
    if (normalized === "/") return runtime.basePath || "/";
    // Emit trailing slash so that GitHub Pages serves the pre-built index.html directly
    // instead of issuing a 301 redirect from /path to /path/ on every hard reload.
    return `${runtime.basePath}${normalized}/`;
  }

  function toRoutePathFromHref(href) {
    if (!href) return "/";
    if (href.startsWith("#/")) return normalizeRoutePath(href.slice(1));
    if (href.startsWith("#")) return getCurrentRoutePath();
    if (href.startsWith("/")) return normalizeRoutePath(stripBasePath(href));
    if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (u.origin !== window.location.origin) return null;
        return normalizeRoutePath(stripBasePath(u.pathname));
      } catch {
        return null;
      }
    }
    return normalizeRoutePath(href);
  }

  function getCurrentRoutePath() {
    let rawPath;
    if (window.location.hash && window.location.hash.startsWith("#/")) {
      rawPath = window.location.hash.slice(1);
    } else {
      rawPath = stripBasePath(window.location.pathname || "/");
    }
    // Decode percent-encoded segments so slugs with spaces/special chars match
    // the raw stored values (e.g. %20 → space, %2B → +).
    try {
      rawPath = rawPath.split("/").map((s) => decodeURIComponent(s)).join("/");
    } catch { /* keep original if malformed */ }
    return normalizeRoutePath(rawPath);
  }

  function getAbsolutePageUrl(routePath) {
    return window.location.origin + toRouteHref(routePath || getCurrentRoutePath());
  }

  function navigateTo(href, opts = {}) {
    const route = toRoutePathFromHref(href);
    if (!route) {
      window.location.href = href;
      return;
    }
    const nextHref = toRouteHref(route);
    const current = window.location.pathname + window.location.search;
    if (current !== nextHref) {
      const method = opts.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextHref);
    }
    handleRoute();
  }

  function normalizeLegacyRouteLinks(root = document) {
    root.querySelectorAll('a[href^="#/"]').forEach((a) => {
      const href = a.getAttribute("href");
      const route = toRoutePathFromHref(href);
      if (route) a.setAttribute("href", toRouteHref(route));
    });
  }

  function initClientRouting() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.startsWith("#") && !href.startsWith("#/")) {
        // Always intercept bare #anchor links. The page has <base href="./"> fixed at
        // the origin root — so after a pushState navigation, href="#heading" resolves
        // to `origin/#heading` (a different path), causing a full page reload and
        // wiping the route. We must always prevent default and scroll programmatically.
        const id = decodeURIComponent(href.slice(1));
        if (!id) return;
        e.preventDefault();
        // In pathname-routing mode, update the URL fragment so the anchor is
        // shareable and back-navigable. Use replaceState so repeated TOC clicks
        // replace the fragment instead of building up a history stack.
        // Explicitly include pathname+search to avoid resolving relative to <base>.
        if (!window.location.hash.startsWith("#/")) {
          history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search + "#" + id
          );
        }
        scrollToId(id);
        return;
      }
      if (href.startsWith("http://") || href.startsWith("https://")) {
        try {
          const u = new URL(href);
          if (u.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      const route = toRoutePathFromHref(href);
      if (!route) return;
      e.preventDefault();
      navigateTo(href);
    });
    window.addEventListener("popstate", handleRoute);
    window.addEventListener("hashchange", () => {
      if (window.location.hash.startsWith("#/")) handleRoute();
    });
    // Legacy #/path links are handled by the click interceptor already;
    // rewrite href attributes in background so right-click "open in new tab" is correct.
    (window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
      : (fn) => setTimeout(fn, 300))(() => normalizeLegacyRouteLinks(document));
  }

  // ── Data Loading ──────────────────────────────────────

  async function loadJSON(url) {
    const res = await fetch(toPublicAssetHref(url));
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return res.json();
  }

  async function loadData() {
    if (state.loaded) return;
    try {
      // Startup: load ONLY the home bundle (~24 KB) — config + homePrerender.
      // All other sections (posts, portfolio, etc.) are fetched lazily per-route.
      let bundleLoaded = false;
      try {
        const bundle = await loadJSON("metadata/home-bundle.json");
        if (bundle && bundle.config) {
          Object.assign(state, {
            config: bundle.config,
            homePrerender: bundle.homePrerender || {},
          });
          applyAccentColor(getConfiguredAccentColor(bundle.config));
          if (bundle.config.logo) {
            const _logo = "content/" + bundle.config.logo;
            (window.requestIdleCallback
              ? (fn) => window.requestIdleCallback(fn, { timeout: 3000 })
              : (fn) => setTimeout(fn, 200))(() => applyLogo(_logo));
          }
          if (bundle.config.hero_title) applyLogoText(bundle.config.hero_title);
          bundleLoaded = true;
        }
      } catch (_) {
        // home-bundle.json not available — fall back to individual files
      }
      if (!bundleLoaded) {
        const [cfg, hp] = await Promise.all([
          loadJSON("metadata/config.json").catch(() => ({})),
          loadJSON("metadata/home-prerender.json").catch(() => ({})),
        ]);
        Object.assign(state, { config: cfg, homePrerender: hp });
        applyAccentColor(getConfiguredAccentColor(state.config));
        if (state.config.logo) {
          const _logo = "content/" + state.config.logo;
          (window.requestIdleCallback
            ? (fn) => window.requestIdleCallback(fn, { timeout: 3000 })
            : (fn) => setTimeout(fn, 200))(() => applyLogo(_logo));
        }
        if (state.config.hero_title) applyLogoText(state.config.hero_title);
      }
      state.loaded = true;
    } catch (err) {
      console.error("Error loading data:", err);
      showContent(
        '<div class="empty-state"><h3>Failed to load data</h3><p>Run: npm run build</p></div>',
      );
    }
  }

  async function applyLogoText(text) {
      document.querySelectorAll(".logo-text").forEach((el) => {
        el.textContent = text;
      });
  }

  async function loadMarkdown(path) {
    const res = await fetch(toPublicAssetHref(path));
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.text();
  }

  function parseMarkdown(text) {
    const gm = text.match(/^---\n([\s\S]*?)\n---/);
    let frontmatter = {};
    let body = text;
    if (gm) {
      body = text.slice(gm[0].length);
      const lines = gm[1].split("\n");
      let currentKey = null;
      let arrayMode = false;
      let objBuffer = null;
      for (const line of lines) {
        const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (kv) {
          if (objBuffer && currentKey) {
            frontmatter[currentKey].push(objBuffer);
            objBuffer = null;
          }
          currentKey = kv[1];
          const val = kv[2].trim().replace(/^["']|["']$/g, "");
          if (val === "") {
            frontmatter[currentKey] = [];
            arrayMode = true;
          } else {
            frontmatter[currentKey] = val;
            arrayMode = false;
          }
        } else if (!objBuffer && arrayMode && currentKey && line.match(/^\s+\w[\w-]*:/) && !line.match(/^\s*-\s/)) {
          // Plain YAML object: `key:\n  subkey: val` (no dash prefix, not inside an array item)
          // Convert from empty array to plain object on first indented property seen.
          // Guard: only fires when objBuffer is null — if we're building an array item object,
          // its sub-keys must be handled by the objBuffer branch below.
          if (Array.isArray(frontmatter[currentKey]) && frontmatter[currentKey].length === 0) {
            frontmatter[currentKey] = {};
          }
          if (typeof frontmatter[currentKey] === "object" && !Array.isArray(frontmatter[currentKey])) {
            const nestedKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
            if (nestedKv)
              frontmatter[currentKey][nestedKv[1]] = nestedKv[2].trim().replace(/^["']|["']$/g, "");
          }
        } else if (arrayMode && currentKey && line.match(/^\s*-\s+\w[\w-]*:/)) {
          if (objBuffer) frontmatter[currentKey].push(objBuffer);
          const objKv = line.match(/^\s*-\s+(\w[\w-]*):\s*(.*)$/);
          objBuffer = {};
          if (objKv)
            objBuffer[objKv[1]] = objKv[2].trim().replace(/^["']|["']$/g, "");
        } else if (objBuffer && line.match(/^\s+\w[\w-]*:/)) {
          const nestedKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
          if (nestedKv)
            objBuffer[nestedKv[1]] = nestedKv[2]
              .trim()
              .replace(/^["']|["']$/g, "");
        } else if (arrayMode && currentKey && line.match(/^\s*-\s+/)) {
          if (objBuffer) {
            frontmatter[currentKey].push(objBuffer);
            objBuffer = null;
          }
          const item = line.replace(/^\s*-\s+/, "").trim();
          if (!Array.isArray(frontmatter[currentKey]))
            frontmatter[currentKey] = [];
          frontmatter[currentKey].push(item);
        }
      }
      if (objBuffer && currentKey) frontmatter[currentKey].push(objBuffer);
    }
    return { frontmatter, body };
  }

  function slugifyHeading(text) {
    return text
      .replace(/<[^>]+>/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function resolveContentLink(href) {
    if (
      !href ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      href.startsWith("/blog/post/") ||
      href.startsWith("/portfolio/") ||
      href.startsWith("/tag/") ||
      href.startsWith("/category/")
    )
      return href;
    const m = href.match(/^\/?(content\/)?blog\/(.+?)(?:#(.+))?$/);
    if (m) {
      const slug = m[2].replace(/\.md$/, "");
      return `/blog/post/${slug}${m[3] ? "#" + m[3] : ""}`;
    }
    const pm = href.match(/^\/?(content\/)?portfolio\/(.+?)(?:#(.+))?$/);
    if (pm) {
      const slug = pm[2].replace(/\.md$/, "");
      return `/portfolio/${slug}${pm[3] ? "#" + pm[3] : ""}`;
    }
    const pgm = href.match(/^\/?(content\/)?pages\/(.+?)(?:#(.+))?$/);
    if (pgm) {
      const slug = pgm[2].replace(/\.md$/, "");
      return `/${slug}${pgm[3] ? "#" + pgm[3] : ""}`;
    }
    return href;
  }

  function renderMd(md, opts = {}) {
    const renderer = new marked.Renderer();
    renderer.image = function (href, title, text) {
      const resolved = resolvePath(typeof href === "object" ? href.href : href);
      return `<img ${buildDetailImageAttrs(resolved, {
        alt: text || "",
        title: title || "",
        loading: "lazy",
      })}>`;
    };
    renderer.heading = function (tokenOrText, level) {
      const raw =
        typeof tokenOrText === "object" ? tokenOrText.text || "" : tokenOrText;
      const depth =
        typeof tokenOrText === "object"
          ? tokenOrText.depth || level || 1
          : level || 1;
      const id = slugifyHeading(raw);
      return `<h${depth} id="${id}">${raw}</h${depth}>\n`;
    };
    renderer.link = function (hrefOrToken, title, text) {
      const rawHref =
        typeof hrefOrToken === "object" ? hrefOrToken.href : hrefOrToken;
      const rawTitle =
        typeof hrefOrToken === "object" ? hrefOrToken.title : title;
      const rawText = typeof hrefOrToken === "object" ? hrefOrToken.text : text;
      const resolved = resolveContentLink(rawHref);
      const external =
        resolved.startsWith("http://") || resolved.startsWith("https://");
      return `<a href="${resolved}"${rawTitle ? ` title="${rawTitle}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${rawText || resolved}</a>`;
    };
    renderer.code = function (codeOrToken, infostring) {
      const rawCode =
        typeof codeOrToken === "object" ? codeOrToken.text || "" : codeOrToken || "";
      const rawLang =
        typeof codeOrToken === "object"
          ? codeOrToken.lang || ""
          : infostring || "";
      const lang = rawLang ? String(rawLang).trim().split(/\s+/)[0] : "";
      const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${classAttr}>${escapeHtml(rawCode)}</code></pre>\n`;
    };
    marked.setOptions({
      renderer,
      highlight: function (code, lang) {
        return escapeHtml(code);
      },
      breaks: opts.breaks || false,
      gfm: true,
    });
    // Protect fenced code blocks and inline code from custom preprocessors
    renderCodeBlocks.length = 0;
    let protected_md = md
      .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, (m) => {
        renderCodeBlocks.push(m);
        return `\x02RAKSARA_CB_${renderCodeBlocks.length - 1}\x03`;
      })
      .replace(/`[^`\n]+`/g, (m) => {
        renderCodeBlocks.push(m);
        return `\x02RAKSARA_CB_${renderCodeBlocks.length - 1}\x03`;
      });
    const preprocessed = restoreRenderCodeBlocks(preprocessCustomComponents(preprocessCustomChips(preprocessCustomContainers(preprocessCustomPanels(preprocessChapters(preprocessToc(preprocessFileAttachments(protected_md))))))));
    const rawHtml = marked.parse(preprocessed);
    return injectCustomComponents(injectChips(injectContainers(injectPanels(injectToc(rawHtml)))));
  }

  // ── TOC Custom Component ──────────────────────────────

  function preprocessToc(md) {
    return md.replace(/::toc\s*\(\s*([^)]*)\s*\)/g, (_m, params) => {
      const raw = String(params || "").trim();
      let type = "bullet";
      let maxLevel = 3;

      const typeMatch = raw.match(/(?:^|,)\s*type\s*=\s*(\w+)/i);
      const levelMatch = raw.match(/(?:^|,)\s*level\s*=\s*(\d+)/i);

      if (typeMatch || levelMatch) {
        if (typeMatch) type = typeMatch[1].toLowerCase();
        if (levelMatch) maxLevel = parseInt(levelMatch[1], 10);
      } else if (raw) {
        const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts[0]) type = parts[0].toLowerCase();
        if (parts[1]) maxLevel = parseInt(parts[1], 10);
      }

      if (type !== "bullet" && type !== "number") type = "bullet";
      if (!Number.isFinite(maxLevel)) maxLevel = 3;
      maxLevel = Math.min(6, Math.max(1, maxLevel));

      return `[[RAKSARA_TOC:${type}:${maxLevel}]]`;
    });
  }

  function injectToc(html) {
    if (!html.includes("[[RAKSARA_TOC:")) return html;
    const headings = [];
    const headingRe = /<h([1-6])[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let m;
    while ((m = headingRe.exec(html)) !== null) {
      headings.push({ level: parseInt(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, "").trim() });
    }
    let tocCounter = 0;
    return html.replace(/(?:<p>)?\[\[RAKSARA_TOC:(\w+):(\d+)\]\](?:<\/p>)?/g, (_match, type, levelStr) => {
      const maxLevel = Number.isFinite(parseInt(levelStr, 10))
        ? Math.min(6, Math.max(1, parseInt(levelStr, 10)))
        : 3;
      const filtered = headings.filter((h) => h.level <= maxLevel);
      if (!filtered.length) return "";
      const tag = type === "number" ? "ol" : "ul";
      const minLevel = Math.min(...filtered.map((h) => h.level));
      const bullets = ["•", "◦", "▪", "▸", "–", "·"];
      const counters = {};
      const items = filtered
        .map((h) => {
          const indent = (h.level - minLevel) * 16;
          let marker;
          if (type === "number") {
            counters[h.level] = (counters[h.level] || 0) + 1;
            for (let l = h.level + 1; l <= 6; l++) counters[l] = 0;
            let label = "";
            for (let l = minLevel; l <= h.level; l++) label += (counters[l] || 0) + ".";
            marker = label;
          } else {
            marker = bullets[(h.level - minLevel) % bullets.length];
          }
          return `<li style="padding-left:${indent}px"><span class="toc-marker">${marker}</span><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`;
        })
        .join("");
      tocCounter += 1;
      const contentId = `toc-content-${tocCounter}`;
      return `<nav class="toc-block" aria-label="Table of contents">
        <div class="toc-head">
          <div class="toc-title">Table of Contents</div>
          <button type="button" class="toc-toggle-btn" data-toc-target="${contentId}" aria-expanded="true" aria-label="Collapse table of contents">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="toc-content" id="${contentId}">
          <${tag} class="toc-list">${items}</${tag}>
        </div>
      </nav>`;
    });
  }

  function initTocBlocks() {
    document.querySelectorAll(".toc-toggle-btn").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toc-target");
        if (!targetId) return;
        const content = document.getElementById(targetId);
        if (!content) return;
        const expanded = btn.getAttribute("aria-expanded") !== "false";
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        btn.setAttribute(
          "aria-label",
          expanded ? "Expand table of contents" : "Collapse table of contents",
        );
        content.hidden = expanded;
      });
    });
  }

  // ── Chapters Custom Component ─────────────────────────

  function preprocessChapters(md) {
    return md.replace(/::chapters\s*\(([^)]+)\)/g, (_m, pathArg) => {
      const clean = pathArg.trim().replace(/^\//, "");
      const parts = clean.split("/");
      // Strip trailing slashes: "novel/raging-sun-silent-moon/chapters/" → "…/chapters"
      const dirPath = (parts[0] === "blog" ? parts.slice(1).join("/") : clean).replace(/\/+$/, "");

      const dir = state.blogDirs && state.blogDirs[dirPath];
      const subdirs = dir ? (dir.subdirs || []) : [];
      const directPosts = dir
        ? (dir.posts || []).map(s => state.posts.find(p => p.slug === s)).filter(Boolean)
        : state.posts.filter(p => p.dir === dirPath || p.slug.startsWith(dirPath + "/") || (p.dir || "").startsWith(dirPath));

      const tableShell = (body) => {
        const blockId = `chb-${dirPath.replace(/[^a-z0-9]/gi, "-") || "root"}`;
        return `<div class="chapters-block" id="${blockId}"><table class="chapters-table" role="table" aria-label="Chapter list for ${escapeHtml(dirPath)}"><thead><tr><th class="chapters-th chapters-th-sortable" data-col="title" data-order="" scope="col">Title</th><th class="chapters-th chapters-th-sortable chapters-th-date" data-col="date" data-order="" scope="col">Date</th><th class="chapters-th chapters-th-type" scope="col">Type</th></tr></thead><tbody>${body}</tbody></table></div>`;
      };

      if (!directPosts.length && !subdirs.length) {
        return tableShell(`<tr class="chapters-row"><td class="chapters-cell-empty" colspan="3">No data</td></tr>`);
      }

      const sortByChapterDate = arr => [...arr].sort((a, b) => {
        const ca = parseInt(a.chapter) || 0, cb = parseInt(b.chapter) || 0;
        return ca !== cb ? ca - cb : new Date(a.date) - new Date(b.date);
      });

      const iconDir = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L9.354 4.646A.5.5 0 009.707 4.8H12.5A1.5 1.5 0 0114 6.3V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.3"/></svg>`;
      const iconPage = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M10 2v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
      const iconChevron = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="chapters-chevron" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      let rows = "";

      for (const subdir of subdirs) {
        const fullPath = dirPath ? `${dirPath}/${subdir}` : subdir;
        const childDir = state.blogDirs && state.blogDirs[fullPath];
        const childPosts = childDir
          ? sortByChapterDate((childDir.posts || []).map(s => state.posts.find(p => p.slug === s)).filter(Boolean))
          : [];
        const label = humanize(subdir);
        const dirId = fullPath.replace(/[^a-zA-Z0-9]/g, "-");

        rows += `<tr class="chapters-row chapters-row-dir" data-dir-id="${escapeHtml(dirId)}" data-expanded="false" data-title="${escapeHtml(label)}" data-date="">
          <td class="chapters-cell-title"><span class="chapters-dir-toggle">${iconChevron}</span><span class="chapters-dir-name">${escapeHtml(label)}</span>${childPosts.length ? `<span class="chapters-dir-badge">${childPosts.length}</span>` : ""}</td>
          <td class="chapters-cell-date">—</td>
          <td class="chapters-cell-type chapters-type-dir" title="Directory">${iconDir}</td>
        </tr>`;

        for (const p of childPosts) {
          rows += `<tr class="chapters-row chapters-row-child" data-parent-dir="${escapeHtml(dirId)}" data-slug="${escapeHtml(p.slug)}" hidden>
            <td class="chapters-cell-title chapters-cell-indented">${escapeHtml(p.title)}</td>
            <td class="chapters-cell-date">${formatDate(p.date)}</td>
            <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
          </tr>`;
        }
      }

      for (const p of sortByChapterDate(directPosts)) {
        rows += `<tr class="chapters-row chapters-row-page" data-slug="${escapeHtml(p.slug)}" data-title="${escapeHtml(p.title)}" data-date="${escapeHtml(p.date || "")}">
          <td class="chapters-cell-title">${escapeHtml(p.title)}</td>
          <td class="chapters-cell-date">${formatDate(p.date)}</td>
          <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
        </tr>`;
      }

      return tableShell(rows);
    });
  }

  function initChaptersBlocks() {
    const PAGE_SIZE = 10;

    document.querySelectorAll(".chapters-block:not([data-init])").forEach(block => {
      block.dataset.init = "1";
      const tbody = block.querySelector("tbody");
      if (!tbody) return;

      function getTopRows() {
        return Array.from(tbody.querySelectorAll(".chapters-row:not(.chapters-row-child)"));
      }

      function applyPagination() {
        block.querySelectorAll(".chapters-footer").forEach(f => f.remove());
        const topRows = getTopRows();
        if (topRows.length <= PAGE_SIZE) return;

        // Show first PAGE_SIZE; hide the rest and their children
        topRows.forEach((row, i) => {
          const visible = i < PAGE_SIZE;
          row.hidden = !visible;
          if (!visible && row.classList.contains("chapters-row-dir")) {
            const dId = row.dataset.dirId;
            tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => { c.hidden = true; });
          }
        });

        let shown = PAGE_SIZE;
        const footer = document.createElement("div");
        footer.className = "chapters-footer";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chapters-show-more";

        function updateBtn() {
          const remaining = topRows.length - shown;
          if (remaining <= 0) { footer.remove(); return; }
          btn.textContent = `Show more (${remaining} remaining)`;
        }

        btn.addEventListener("click", () => {
          topRows.slice(shown, shown + PAGE_SIZE).forEach(row => {
            row.hidden = false;
            if (row.classList.contains("chapters-row-dir")) {
              const dId = row.dataset.dirId;
              tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => {
                c.hidden = row.dataset.expanded !== "true";
              });
            }
          });
          shown += PAGE_SIZE;
          updateBtn();
        });

        updateBtn();
        footer.appendChild(btn);
        block.appendChild(footer);
      }

      // Sortable headers
      block.querySelectorAll(".chapters-th-sortable").forEach(th => {
        th.addEventListener("click", () => {
          const col = th.dataset.col;
          const next = th.dataset.order === "asc" ? "desc" : "asc";
          block.querySelectorAll(".chapters-th-sortable").forEach(h => { h.dataset.order = ""; });
          th.dataset.order = next;

          // Unhide all top-level rows before sorting; collapse all children
          const topRows = getTopRows();
          topRows.forEach(row => { row.hidden = false; });
          tbody.querySelectorAll(".chapters-row-child").forEach(c => { c.hidden = true; });

          topRows.sort((a, b) => {
            if (col === "date") {
              const ta = new Date(a.dataset.date || "").getTime() || 0;
              const tb = new Date(b.dataset.date || "").getTime() || 0;
              return next === "asc" ? ta - tb : tb - ta;
            }
            const va = (a.dataset.title || "").toLowerCase();
            const vb = (b.dataset.title || "").toLowerCase();
            return next === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
          });

          for (const row of topRows) {
            tbody.appendChild(row);
            if (row.classList.contains("chapters-row-dir")) {
              row.dataset.expanded = "false";
              const dId = row.dataset.dirId;
              tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => tbody.appendChild(c));
            }
          }

          // Re-apply pagination (collapses to first PAGE_SIZE)
          applyPagination();
        });
      });

      // Dir expand/collapse
      block.querySelectorAll(".chapters-row-dir").forEach(row => {
        row.addEventListener("click", () => {
          const dId = row.dataset.dirId;
          const expanded = row.dataset.expanded === "true";
          row.dataset.expanded = expanded ? "false" : "true";
          tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => { c.hidden = expanded; });
        });
      });

      // Page/child row click to navigate
      block.addEventListener("click", e => {
        const row = e.target.closest(".chapters-row-page, .chapters-row-child[data-slug]");
        if (!row || e.target.closest(".chapters-row-dir")) return;
        const slug = row.dataset.slug;
        if (slug) navigateTo(toRouteHref(`/blog/post/${slug.split("/").map(encodeURIComponent).join("/")}`));
      });

      applyPagination();
    });
  }

  function initComponentLists() {
    document.querySelectorAll(".component-list-search").forEach((input) => {
      if (input.dataset.bound === "1") return;
      input.dataset.bound = "1";
      const listId = input.getAttribute("data-list");
      const list = listId ? document.getElementById(listId) : null;
      if (!list) return;
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        const cards = list.querySelectorAll(".component-card");
        let visible = 0;
        cards.forEach((card) => {
          const title = (card.getAttribute("data-title") || "").toLowerCase();
          const desc = (card.getAttribute("data-desc") || "").toLowerCase();
          const match = !q || title.includes(q) || desc.includes(q);
          card.style.display = match ? "" : "none";
          if (match) visible++;
        });
        // Show/hide empty state
        let empty = list.querySelector(".component-list-empty");
        if (!empty) {
          empty = document.createElement("p");
          empty.className = "component-list-empty";
          empty.textContent = "No components match your search.";
          list.appendChild(empty);
        }
        empty.style.display = visible === 0 ? "" : "none";
      });
    });
  }

  // ── Rendering Helpers ─────────────────────────────────

  function showContent(html) {
    const el = document.getElementById("page-content");
    delete el.dataset.prerendered; // clear stale prerendered flag on any content transition
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.innerHTML = html;
    normalizeLegacyRouteLinks(el);
    initTocBlocks();
    initChaptersBlocks();
    initComponentLists();
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    window.scrollTo(0, 0);
  }

  function showLoading() {
    showContent('<div class="loading">Loading...</div>');
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderStatusChip(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (!["draft", "ongoing", "completed"].includes(normalized)) return "";
    return `<span class="status-chip status-${normalized}">${escapeHtml(humanize(normalized))}</span>`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    const el = document.createElement("div");
    el.textContent = str;
    return el.innerHTML;
  }

  function resolvePath(p) {
    if (!p) return p;
    if (
      p.startsWith("http://") ||
      p.startsWith("https://") ||
      p.startsWith("data:")
    )
      return p;
    return p.replace(/^\/+/, "");
  }

  function toPublicAssetHref(pathname) {
    const resolved = resolvePath(pathname);
    if (!resolved) return resolved;
    if (
      resolved.startsWith("http://") ||
      resolved.startsWith("https://") ||
      resolved.startsWith("data:")
    ) {
      return resolved;
    }
    // Encode each path segment so filenames with spaces or special chars are
    // valid in fetch() URLs (e.g. "Part I - title" → "Part%20I%20-%20title").
    const encoded = resolved.split("/").map((s) => encodeURIComponent(s)).join("/");
    return toAssetHref(encoded);
  }

  function getImageManifestEntry(src) {
    const resolved = resolvePath(src);
    if (!resolved) return null;
    return state.imageManifest[resolved] || null;
  }

  function buildResponsiveImageAttrs(src, options = {}) {
    const resolved = resolvePath(src);
    if (!resolved) return "";

    const {
      alt = "",
      title = "",
      className = "",
      loading = "lazy",
      fetchPriority = "auto",
      sizes = "100vw",
      decoding = "async",
      maxSrcsetWidth = Infinity,
    } = options;

    const attrs = [`src="${escapeHtml(toPublicAssetHref(resolved))}"`, `alt="${escapeHtml(alt)}"`];
    const manifestEntry = getImageManifestEntry(resolved);

    if (className) attrs.push(`class="${escapeHtml(className)}"`);
    if (title) attrs.push(`title="${escapeHtml(title)}"`);
    if (loading) attrs.push(`loading="${loading}"`);
    if (decoding) attrs.push(`decoding="${decoding}"`);
    if (fetchPriority && fetchPriority !== "auto") {
      attrs.push(`fetchpriority="${fetchPriority}"`);
    }

    if (manifestEntry) {
      const variants = Array.isArray(manifestEntry.variants)
        ? manifestEntry.variants
            .filter((variant) => variant && variant.path && variant.width && variant.width <= maxSrcsetWidth)
            .sort((left, right) => left.width - right.width)
        : [];
      const srcset = variants.map(
        (variant) => `${escapeHtml(toPublicAssetHref(variant.path))} ${variant.width}w`,
      );

      if (manifestEntry.width) {
        if (manifestEntry.width <= maxSrcsetWidth) {
          srcset.push(`${escapeHtml(toPublicAssetHref(resolved))} ${manifestEntry.width}w`);
        }
        attrs.push(`width="${manifestEntry.width}"`);
      }
      if (manifestEntry.height) {
        attrs.push(`height="${manifestEntry.height}"`);
      }
      if (srcset.length) {
        attrs.push(`srcset="${srcset.join(", ")}"`);
        attrs.push(`sizes="${escapeHtml(sizes)}"`);
      }
      if (manifestEntry.lqip) {
        attrs.push(`data-lqip="${escapeHtml(manifestEntry.lqip)}"`);
      }
    }

    return attrs.join(" ");
  }

  function buildDetailImageAttrs(src, options = {}) {
    const resolved = resolvePath(src);
    if (!resolved) return "";

    const {
      alt = "",
      title = "",
      className = "",
      loading = "lazy",
      fetchPriority = "auto",
      decoding = "async",
    } = options;

    const attrs = [`src="${escapeHtml(toPublicAssetHref(resolved))}"`, `alt="${escapeHtml(alt)}"`];
    const manifestEntry = getImageManifestEntry(resolved);

    if (className) attrs.push(`class="${escapeHtml(className)}"`);
    if (title) attrs.push(`title="${escapeHtml(title)}"`);
    if (loading) attrs.push(`loading="${loading}"`);
    if (decoding) attrs.push(`decoding="${decoding}"`);
    if (fetchPriority && fetchPriority !== "auto") {
      attrs.push(`fetchpriority="${fetchPriority}"`);
    }

    if (manifestEntry && manifestEntry.width) {
      attrs.push(`width="${manifestEntry.width}"`);
    }
    if (manifestEntry && manifestEntry.height) {
      attrs.push(`height="${manifestEntry.height}"`);
    }

    return attrs.join(" ");
  }

  // ── SEO Meta ──────────────────────────────────────────

  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      const parts = selector.match(/\[(\w+)=["']?([^"'\]]+)/);
      if (parts) el.setAttribute(parts[1], parts[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value || "");
  }

  function setStructuredData(data) {
    const existing = document.getElementById("structured-data");
    if (existing) existing.remove();
    if (!data) return;
    const script = document.createElement("script");
    script.id = "structured-data";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function updatePageMeta({ title, description, image, type, author, keywords, url, structuredData, robots } = {}) {
    const siteName = (state.config && state.config.hero_title) || "Raksara";
    const siteDesc =
      (state.config && state.config.hero_subtitle) ||
      "A place where ideas, knowledge, and engineering thoughts are recorded.";
    const siteAuthor = (state.config && state.config.author) || "";
    const siteImage = (state.config && state.config.og_image)
      ? resolvePath(state.config.og_image)
      : "";

    const pageTitle = title ? `${title} — ${siteName}` : siteName;
    const pageDesc = description || siteDesc;
    const pageImage = image || siteImage;
    const pageType = type || "website";
    const pageAuthor = author || siteAuthor;
    const pageKeywords = Array.isArray(keywords) ? keywords.join(", ") : (keywords || "");
    const pageUrl = url || getAbsolutePageUrl(getCurrentRoutePath());

    document.title = pageTitle;
    setMeta('meta[name="description"]', "content", pageDesc);
    setMeta('meta[name="author"]', "content", pageAuthor);
    setMeta('meta[name="robots"]', "content", robots || "index, follow");
    if (pageKeywords) setMeta('meta[name="keywords"]', "content", pageKeywords);
    setMeta('meta[property="og:site_name"]', "content", siteName);
    setMeta('meta[property="og:title"]', "content", pageTitle);
    setMeta('meta[property="og:description"]', "content", pageDesc);
    setMeta('meta[property="og:type"]', "content", pageType);
    setMeta('meta[property="og:url"]', "content", pageUrl);
    if (pageImage) setMeta('meta[property="og:image"]', "content", pageImage);
    setMeta('meta[name="twitter:card"]', "content", pageImage ? "summary_large_image" : "summary");
    setMeta('meta[name="twitter:title"]', "content", pageTitle);
    setMeta('meta[name="twitter:description"]', "content", pageDesc);
    if (pageImage) setMeta('meta[name="twitter:image"]', "content", pageImage);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;
    setStructuredData(structuredData || null);
  }

  // ── File Attachments ──────────────────────────────────

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function getFileCategory(ext) {
    const e = (ext || "").toLowerCase();
    if (["pdf"].includes(e)) return "pdf";
    if (["doc", "docx", "odt", "rtf"].includes(e)) return "doc";
    if (["xls", "xlsx", "ods", "csv"].includes(e)) return "xls";
    if (["ppt", "pptx", "odp"].includes(e)) return "ppt";
    if (["zip", "rar", "gz", "tar", "7z", "bz2"].includes(e)) return "zip";
    if (
      ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "avif"].includes(e)
    )
      return "img";
    if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(e)) return "video";
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(e)) return "audio";
    if (
      [
        "js", "ts", "jsx", "tsx", "py", "java", "go", "rs", "c", "cpp",
        "cs", "php", "rb", "sh", "bash", "html", "css", "json", "yml",
        "yaml", "toml", "xml", "sql",
      ].includes(e)
    )
      return "code";
    if (["md", "txt", "log", "tex"].includes(e)) return "text";
    return "file";
  }

  function getFileTypeLabel(ext) {
    const e = (ext || "").toLowerCase();
    const labels = {
      pdf: "PDF", doc: "DOC", docx: "DOC", odt: "ODT", rtf: "RTF",
      xls: "XLS", xlsx: "XLS", ods: "ODS", csv: "CSV",
      ppt: "PPT", pptx: "PPT", odp: "ODP",
      zip: "ZIP", rar: "RAR", gz: "GZ", tar: "TAR", "7z": "7Z", bz2: "BZ2",
      jpg: "JPG", jpeg: "JPG", png: "PNG", gif: "GIF", svg: "SVG",
      webp: "WEBP", bmp: "BMP", avif: "AVIF",
      mp4: "MP4", mov: "MOV", avi: "AVI", mkv: "MKV", webm: "WEBM",
      mp3: "MP3", wav: "WAV", ogg: "OGG", flac: "FLAC", aac: "AAC", m4a: "M4A",
      md: "MD", txt: "TXT", log: "LOG", tex: "TEX",
      js: "JS", ts: "TS", jsx: "JSX", tsx: "TSX", py: "PY", java: "JAVA",
      go: "GO", rs: "RS", c: "C", cpp: "CPP", cs: "C#", php: "PHP",
      rb: "RB", sh: "SH", bash: "SH", html: "HTML", css: "CSS",
      json: "JSON", yml: "YAML", yaml: "YAML", toml: "TOML", xml: "XML", sql: "SQL",
    };
    return labels[e] || e.toUpperCase().slice(0, 5) || "FILE";
  }

  function renderFileAttachmentHtml(filePath, displayName) {
    const resolved = toPublicAssetHref(filePath);
    const filename = displayName || filePath.split("/").pop();
    const dotIdx = filename.lastIndexOf(".");
    const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
    const category = getFileCategory(ext);
    const label = getFileTypeLabel(ext);
    const fontSize = label.length > 3 ? "7" : "9";
    const iconSvg = `<svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.75" y="0.75" width="42.5" height="50.5" rx="5.25" fill="var(--bg-card)" stroke="var(--border-color)" stroke-width="1.5"/><path d="M27 1 L43 17 L27 17 Z" fill="var(--file-fold-color)" opacity="0.45"/><path d="M27 1 L27 17 L43 17" stroke="var(--border-color)" stroke-width="1.5" fill="none" stroke-linejoin="round"/><text x="22" y="37" text-anchor="middle" fill="var(--file-label-color)" font-weight="700" font-size="${fontSize}" font-family="system-ui,sans-serif" letter-spacing="0.8">${escapeHtml(label)}</text></svg>`;
    return `<div class="file-attachment-block"><a class="file-attachment" href="${escapeHtml(resolved)}" download data-ext="${escapeHtml(ext)}" data-category="${escapeHtml(category)}"><div class="file-attachment-icon">${iconSvg}</div><div class="file-attachment-info"><span class="file-attachment-name">${escapeHtml(filename)}</span><span class="file-attachment-meta"><span class="file-attachment-badge">${escapeHtml(label || ext || "FILE")}</span><span class="file-attachment-size" data-size-url="${escapeHtml(resolved)}"></span></span></div><div class="file-attachment-dl"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5l3.5 4 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div></a></div>`;
  }

  function preprocessFileAttachments(md) {
    return md.replace(/::file\[([^\]\n]+)\]/g, (_match, inner) => {
      const nameMatch = inner.match(/^(.*?)\s+"([^"]+)"$/);
      const filePath = (nameMatch ? nameMatch[1] : inner).trim();
      const displayName = nameMatch ? nameMatch[2] : null;
      if (!filePath) return _match;
      return renderFileAttachmentHtml(filePath, displayName);
    });
  }

  // ── Custom Element: PANEL ────────────────────────────────

  // Module-scope code-block vault — populated during renderMd so inject
  // functions (injectPanels, injectContainers) can restore inline/fenced
  // code that was hidden before preprocessors ran.
  const renderCodeBlocks = [];
  const restoreRenderCodeBlocks = (s) =>
    s.replace(/\x02RAKSARA_CB_(\d+)\x03/g, (_, i) => renderCodeBlocks[parseInt(i, 10)] || "");

  const panelStorage = [];

  function preprocessCustomPanels(md) {
    panelStorage.length = 0;
    return md.replace(/\<panel\s+type=["']?(info|note|warning|error|success)["']?\s*\>([\s\S]*?)\<\/panel\>/gi, (_match, type, inner) => {
      panelStorage.push({ type: type.toLowerCase(), content: inner.trim() });
      return `[[RAKSARA_PANEL:${panelStorage.length - 1}]]`;
    });
  }

  function injectPanels(html) {
    if (panelStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_PANEL:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= panelStorage.length) return match;
      const { type, content } = panelStorage[index];
      const panelContent = marked.parse(restoreRenderCodeBlocks(content));
      const icons = {
        info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        note: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/><path d="M4 5h8M4 8.5h8M4 12h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };
      const icon = icons[type] || icons.info;
      return `<div class="panel panel-${type}" role="note"><span class="panel-icon">${icon}</span><div class="panel-body">${panelContent}</div></div>`;
    });
  }

  // ── Custom Element: CONTAINER ────────────────────────────────

  const containerStorage = [];

  function preprocessCustomContainers(md) {
    containerStorage.length = 0;
    return md.replace(/\<container\s*\>([\s\S]*?)\<\/container\>/gi, (_match, inner) => {
      containerStorage.push(inner.trim());
      return `[[RAKSARA_CONTAINER:${containerStorage.length - 1}]]`;
    });
  }

  function injectContainers(html) {
    if (containerStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_CONTAINER:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= containerStorage.length) return match;
      const content = marked.parse(restoreRenderCodeBlocks(containerStorage[index]));
      return `<div class="custom-container glass">${content}</div>`;
    });
  }

  // ── Custom Element: CHIP ────────────────────────────────

  const chipStorage = [];

  function preprocessCustomChips(md) {
    chipStorage.length = 0;
    return md.replace(/\<chip((?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*\>([\s\S]*?)\<\/chip\>/gi, (_match, attrsStr, inner) => {
      const attrs = parseChipAttributes(attrsStr);
      chipStorage.push({ attrs, content: inner.trim() });
      return `[[RAKSARA_CHIP:${chipStorage.length - 1}]]`;
    });
  }

  function parseChipAttributes(str) {
    const attrs = { icon: null, label: null };
    const matches = str.matchAll(/(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1];
      const value = m[2] || m[3] || m[4] || "";
      if (key === "icon") attrs.icon = value;
      if (key === "label") attrs.label = value;
    }
    return attrs;
  }

  function injectChips(html) {
    if (chipStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_CHIP:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= chipStorage.length) return match;
      const { attrs, content } = chipStorage[index];
      const iconHtml = renderChipIcon(attrs.icon);
      const labelHtml = attrs.label ? `<span class="chip-label">${escapeHtml(attrs.label)}</span>` : "";
      return `<span class="chip glass">${iconHtml}${labelHtml}<span class="chip-text">${escapeHtml(content)}</span></span>`;
    });
  }

  function renderChipIcon(icon) {
    if (!icon) return "";
    const namedIcons = {
      check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      star: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
      tag: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2h6a1 1 0 011 1v5a1 1 0 01-1 1H8l-6 6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="11" cy="5" r="1" fill="currentColor"/></svg>',
      link: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 9a3 3 0 103-3M10 7a3 3 0 11-1.5 2.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      user: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 3L1 8l3.5 5M11.5 3l3.5 5-3.5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'arrow-right': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      external: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-1.5M2 7v6a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    if (namedIcons[icon]) {
      return `<span class="chip-icon">${namedIcons[icon]}</span>`;
    }
    // Check if it's an emoji or single character
    if (icon.length > 0 && !/^https?:\/\/|^\//.test(icon)) {
      return `<span class="chip-icon-text">${escapeHtml(icon)}</span>`;
    }
    return "";
  }

  // ── ::component Card List ────────────────────────────

  const componentStorage = [];

  function preprocessCustomComponents(md) {
    componentStorage.length = 0;
    return md.replace(/::component\s*\(\s*([^)]+?)\s*\)/g, (match, pathArg) => {
      componentStorage.push(pathArg.trim());
      return `[[RAKSARA_COMPONENT:${componentStorage.length - 1}]]`;
    });
  }

  function injectCustomComponents(html) {
    if (componentStorage.length === 0) return html;
    return html.replace(/(?:<p>)?\[\[RAKSARA_COMPONENT:(\d+)\]\](?:<\/p>)?/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= componentStorage.length) return match;
      const pathArg = componentStorage[index];
      const prefix = "content/" + pathArg.replace(/^\/|\/$/g, "") + "/";
      const allEntries = [...(state.docs || []), ...(state.pages || [])];
      const matching = allEntries.filter(e => e.path && e.path.startsWith(prefix));
      if (matching.length === 0) return "";
      const listId = `cl-${Math.random().toString(36).substr(2, 8)}`;
      let out = `<div class="component-list-wrap">`;
      out += `<div class="component-list-search-wrap"><input class="component-list-search" type="search" placeholder="Filter components…" aria-label="Filter components" data-list="${listId}"></div>`;
      out += `<div class="component-list" id="${listId}">`;
      for (const entry of matching) {
        const title = escapeHtml(entry.title || "Untitled");
        const desc = escapeHtml(entry.summary || entry.description || "");
        const icon = entry.icon || "";
        const status = entry.status || "";
        const href = `#/${entry.slug}`;
        out += `<a href="${href}" class="component-card glass"`;
        out += ` data-title="${escapeHtml((entry.title || "").toLowerCase())}" data-desc="${escapeHtml((entry.summary || entry.description || "").toLowerCase())}"`;
        out += `>`;
        out += `<div class="component-card-header">`;
        if (icon) out += `<span class="component-card-icon">${escapeHtml(icon)}</span>`;
        out += `<span class="component-card-title">${title}</span>`;
        if (status) {
          const statusClass = "status-" + status.toLowerCase().replace(/\s+/g, "-");
          out += `<span class="component-card-status ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>`;
        }
        out += `</div>`;
        if (desc) out += `<p class="component-card-desc">${desc}</p>`;
        out += `<div class="component-card-footer">`;
        out += `<span class="component-card-link">See detail →</span>`;
        out += `</div>`;
        out += `</a>`;
      }
      out += '</div></div>';
      return out;
    });
  }

  // ── Table Sorting ────────────────────────────────────

  function initSortableTables() {
    const tables = document.querySelectorAll(".article-body table");
    tables.forEach((table) => {
      const thead = table.querySelector("thead");
      if (!thead) return;
      const headers = thead.querySelectorAll("th");
      headers.forEach((th, colIndex) => {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.setAttribute("role", "button");
        th.setAttribute("aria-sort", "none");
        const sortIcon = document.createElement("span");
        sortIcon.className = "sort-icon";
        sortIcon.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="display: inline; margin-left: 4px;"><path d="M3 1l2 2 2-2M3 6l2-2 2 2" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>';
        th.appendChild(sortIcon);
        th.addEventListener("click", () => sortTable(table, colIndex, th, headers));
      });
    });
  }

  function sortTable(table, colIndex, th, headers) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const currentSort = th.getAttribute("aria-sort") || "none";
    let isAsc = currentSort === "none" || currentSort === "desc";
    if (currentSort === "none") {
      headers.forEach((h) => h.setAttribute("aria-sort", "none"));
      th.setAttribute("aria-sort", "ascending");
      isAsc = true;
    } else if (currentSort === "ascending") {
      th.setAttribute("aria-sort", "descending");
      isAsc = false;
    } else {
      th.setAttribute("aria-sort", "none");
      isAsc = null;
    }
    if (isAsc === null) {
      const firstRow = tbody.querySelector("tr");
      if (firstRow) {
        const origOrder = Array.from(firstRow.parentElement.querySelectorAll("tr"));
        origOrder.forEach((r) => tbody.appendChild(r));
      }
      return;
    }
    rows.sort((rowA, rowB) => {
      const cellA = rowA.querySelectorAll("td")[colIndex]?.textContent.trim() || "";
      const cellB = rowB.querySelectorAll("td")[colIndex]?.textContent.trim() || "";
      const numA = parseFloat(cellA);
      const numB = parseFloat(cellB);
      const isNumeric = !isNaN(numA) && !isNaN(numB) && cellA !== "" && cellB !== "";
      if (isNumeric) {
        return isAsc ? numA - numB : numB - numA;
      }
      return isAsc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });
    rows.forEach((r) => tbody.appendChild(r));
  }

  async function initFileAttachments() {
    const els = document.querySelectorAll(
      ".file-attachment-size[data-size-url]",
    );
    await Promise.all(
      Array.from(els).map(async (el) => {
        const url = el.dataset.sizeUrl;
        el.removeAttribute("data-size-url");
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            const cl = res.headers.get("content-length");
            el.textContent = cl ? formatFileSize(parseInt(cl, 10)) : "";
          }
        } catch {
          // size unavailable — leave empty
        }
      }),
    );
  }

  function getGalleryImages(g) {
    const raw = Array.isArray(g.images) && g.images.length > 0
      ? g.images
      : g.image
        ? [{ src: g.image, caption: g.caption || "" }]
        : [];

    const normalized = raw
      .map((img) => {
        if (!img) return null;
        if (typeof img === "string") {
          return { src: img, caption: g.caption || "" };
        }
        if (typeof img === "object") {
          return {
            src: img.src || "",
            caption: img.caption || g.caption || "",
          };
        }
        return null;
      })
      .filter((img) => img && img.src);

    // Deduplicate exact repeated sources to avoid duplicate carousel frames.
    const seen = new Set();
    return normalized.filter((img) => {
      const key = resolvePath(img.src);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getImageShell(img) {
    return img.closest(
      ".post-card-thumb, .gallery-item, .gallery-card-img, .gallery-stack-card, .article-cover, .poem-cover, .profile-avatar-wrap",
    );
  }

  async function settleImage(img) {
    try {
      if (typeof img.decode === "function") {
        await img.decode();
      }
    } catch {
      // Ignore decode failures and reveal the image anyway.
    }

    img.classList.add("loaded");
    const shell = getImageShell(img);
    if (shell) {
      shell.classList.remove("is-loading");
      shell.classList.add("is-loaded");
    }
  }

  function initLazyImages(root) {
    const imgs = Array.from(
      (root || document).querySelectorAll("img:not(.loaded)")
    );

    // Separate LCP candidate (first image in the list, loaded eagerly) from
    // the rest so we can batch all non-LCP LQIP style mutations into one RAF
    // instead of triggering N independent style invalidations.
    const lqipBatch = [];

    imgs.forEach((img, idx) => {
      const shell = getImageShell(img);
      if (shell && !shell.classList.contains("is-loaded")) {
        shell.classList.add("is-loading");
        const lqip = img.dataset.lqip;
        if (lqip) {
          if (idx === 0) {
            // LCP image: apply LQIP inline so the placeholder appears
            // on the very next frame without waiting for a batch.
            shell.style.setProperty("--lqip-url", `url("${lqip}")`);
            requestAnimationFrame(() => {
              if (!shell.classList.contains("is-loaded")) {
                shell.classList.add("lqip-shown");
              }
            });
          } else {
            // Non-LCP: queue for single batched RAF below.
            lqipBatch.push({ shell, lqip });
          }
        }
      }

      if (img.complete) {
        settleImage(img);
        return;
      }

      img.addEventListener("load", () => settleImage(img), { once: true });
      img.addEventListener("error", () => settleImage(img), { once: true });
    });

    // One RAF for all remaining LQIP injections — single style recalculation
    // instead of one per image, reducing layout thrashing on busy pages.
    if (lqipBatch.length) {
      requestAnimationFrame(() => {
        lqipBatch.forEach(({ shell, lqip }) => {
          shell.style.setProperty("--lqip-url", `url("${lqip}")`);
          if (!shell.classList.contains("is-loaded")) {
            shell.classList.add("lqip-shown");
          }
        });
      });
    }
  }

  // ── Page Renderers ────────────────────────────────────

  let _typingTimer = null;

  function initHeroTyping(title) {
    if (_typingTimer) {
      clearTimeout(_typingTimer);
      _typingTimer = null;
    }
    const span = document.querySelector(".accent-gradient");
    if (!span) return;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobileViewport = window.innerWidth < 768;
    if (reduceMotion || isMobileViewport) {
      span.textContent = title;
      span.classList.add("typed");
      document.querySelectorAll(".hero-cursor").forEach((node) => node.remove());
      return;
    }
    span.textContent = "";
    span.classList.remove("typed");
    const cursor = document.createElement("span");
    cursor.className = "hero-cursor";
    cursor.textContent = "|";
    span.after(cursor);
    const chars = title.split("");
    const total = chars.length;
    const slowCount = 3;
    const baseDelay = 70;
    let i = 0;
    function typeNext() {
      if (i >= total) {
        cursor.classList.add("hero-cursor-done");
        _typingTimer = setTimeout(() => {
          cursor.remove();
          span.classList.add("typed");
          _typingTimer = null;
        }, 600);
        return;
      }
      span.textContent += chars[i];
      const remaining = total - i - 1;
      let delay = baseDelay;
      if (remaining < slowCount)
        delay = baseDelay * Math.pow(2.5, slowCount - remaining);
      i++;
      _typingTimer = setTimeout(typeNext, delay);
    }
    _typingTimer = setTimeout(typeNext, 400);
  }

  async function renderHome() {
    const heroTitle = (state.config && state.config.hero_title) || "Raksara";
    const heroSubtitle =
      (state.config && state.config.hero_subtitle) ||
      "A place where ideas, knowledge, and engineering thoughts are recorded.";

    // If content was pre-rendered into HTML, reuse it — no re-render or fade-in needed
    const pageEl = document.getElementById("page-content");
    if (pageEl && pageEl.dataset.prerendered === "home") {
      delete pageEl.dataset.prerendered;
      // Ensure no leftover opacity/transform from a prior showLoading() call
      pageEl.style.opacity = "";
      pageEl.style.transform = "";
      pageEl.style.transition = "";
      updatePageMeta({ title: null, description: heroSubtitle });
      // Immediately fill the hero title so the span is never blank —
      // prevents subtitle from jumping while initHeroTyping waits for idle.
      const _titleSpan1 = pageEl.querySelector(".accent-gradient");
      if (_titleSpan1 && !_titleSpan1.textContent.trim()) {
        _titleSpan1.textContent = heroTitle;
        if (window.innerWidth < 768 ||
            (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          _titleSpan1.classList.add("typed");
        }
      }
      // initLazyImages runs immediately: eager LCP image must be settled ASAP.
      initLazyImages();
      // Parallax, portfolio card wiring, and typing are all deferred to idle
      // so the main thread is free for user input from first paint.
      const scheduleVisual = window.requestIdleCallback
        ? (fn) => window.requestIdleCallback(fn, { timeout: 1000 })
        : (fn) => setTimeout(fn, 0);
      scheduleVisual(() => {
        initParallax();
        initPortfolioCards();
        initHeroTyping(heroTitle);
      });
      return;
    }

    // Use prerendered markup from JS state if available
    if (state.homePrerender && state.homePrerender.html) {
      showContent(state.homePrerender.html);
      updatePageMeta({
        title: null,
        description: heroSubtitle,
      });
      const _titleSpan2 = document.querySelector(".accent-gradient");
      if (_titleSpan2 && !_titleSpan2.textContent.trim()) {
        _titleSpan2.textContent = heroTitle;
        if (window.innerWidth < 768 ||
            (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
          _titleSpan2.classList.add("typed");
        }
      }
      initLazyImages();
      const scheduleVisual = window.requestIdleCallback
        ? (fn) => window.requestIdleCallback(fn, { timeout: 1000 })
        : (fn) => setTimeout(fn, 0);
      scheduleVisual(() => {
        initParallax();
        initPortfolioCards();
        initHeroTyping(heroTitle);
      });
      return;
    }

    // Fallback to dynamic rendering
    await Promise.all([
      ensureSection("posts"),
      ensureSection("portfolio"),
      ensureSection("thoughts"),
      ensureSection("gallery"),
    ]);
    const recentPosts = state.posts.slice(0, 3);
    const recentThoughts = state.thoughts.slice(0, 2);

    let postsHtml = recentPosts
      .map((post, index) =>
        renderPostCard(post, {
          imageLoading: index === 0 ? "eager" : "lazy",
          fetchPriority: index === 0 ? "high" : "auto",
        }),
      )
      .join("");

    let portfolioHtml = state.portfolio
      .slice(0, 4)
      .map((p) => renderPortfolioCard(p))
      .join("");

    let thoughtsHtml = recentThoughts.map((t) => renderThoughtCard(t)).join("");

    const homeGalleryStackHtml = renderHomeGalleryStack();

    const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg></div>`;

    showContent(`
      <div class="home-hero" id="profile-hero">
        <div class="home-hero-aurora" id="home-hero-bg"></div>
        <div class="home-hero-content">
          <h1 class="home-hero-title">
            <span class="accent-gradient"></span>
          </h1>
          <p class="home-hero-subtitle">${escapeHtml(heroSubtitle)}</p>
        </div>
        ${waveSvg}
      </div>

      <div class="home-section">
        <div class="home-section-header"><h2>Recent Posts</h2><a href="/blog">View all \u2192</a></div>
        <div class="post-list">${postsHtml || '<div class="empty-state"><p>No posts yet.</p></div>'}</div>
      </div>

      <div class="home-section">
        <div class="home-section-header"><h2>Projects</h2><a href="/portfolio">View all \u2192</a></div>
        <div class="portfolio-grid">${portfolioHtml || '<div class="empty-state"><p>No projects yet.</p></div>'}</div>
      </div>

      ${
        homeGalleryStackHtml
          ? `<div class="home-section">
        ${homeGalleryStackHtml}
      </div>`
          : ""
      }

      ${
        thoughtsHtml
          ? `<div class="home-section">
        <div class="home-section-header"><h2>Shower Thoughts</h2><a href="/thoughts">View all \u2192</a></div>
        <div class="thoughts-list">${thoughtsHtml}</div>
      </div>`
          : ""
      }
    `);
    updatePageMeta({
      title: null,
      description: heroSubtitle,
    });
    const _titleSpan3 = document.querySelector(".accent-gradient");
    if (_titleSpan3 && !_titleSpan3.textContent.trim()) {
      _titleSpan3.textContent = heroTitle;
      if (window.innerWidth < 768 ||
          (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
        _titleSpan3.classList.add("typed");
      }
    }
    initLazyImages();
    const scheduleVisual = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 1000 })
      : (fn) => setTimeout(fn, 0);
    scheduleVisual(() => {
      initParallax();
      initPortfolioCards();
      initHeroTyping(heroTitle);
    });
  }

  function renderHomeGalleryStack() {
    const stackSources = state.gallery
      .slice(0, 3)
      .map((g) => {
        const imgs = getGalleryImages(g);
        return imgs.length ? resolvePath(imgs[0].src) : "";
      })
      .filter(Boolean);
    if (!stackSources.length) return "";
    while (stackSources.length < 3) stackSources.push(stackSources[stackSources.length - 1]);
    return `
    <div class="gallery-window">
    <a href="/gallery" class="gallery-window-link" aria-label="View gallery">
      <div class="gallery-window-chrome">
        <div class="gallery-window-dots">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <div class="gallery-window-title">Gallery</div>
      </div>
      <div class="gallery-window-body">
        <div class="gallery-stack">
          <div class="gallery-stack-card layer-1 is-loading"><img ${buildResponsiveImageAttrs(stackSources[0], { alt: "Gallery preview 1", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" })}></div>
          <div class="gallery-stack-card layer-2 is-loading"><img ${buildResponsiveImageAttrs(stackSources[1], { alt: "Gallery preview 2", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" })}></div>
          <div class="gallery-stack-card layer-3 is-loading"><img ${buildResponsiveImageAttrs(stackSources[2], { alt: "Gallery preview 3", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" })}></div>
        </div>
      </div>
      </a>
    </div>`;
  }

  // ── Blog ──────────────────────────────────────────────

  function humanize(slug) {
    return slug
      .replace(/-{2,}/g, " \u2013 ")   // 2+ hyphens → " – " separator
      .replace(/[-_]/g, " ")             // single hyphens/underscores → space
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  function blogBreadcrumbs(segments, options) {
    const BREADCRUMB_MAX_VISIBLE = 3;
    const { linkLast = false, lastLabel = "" } = options || {};
    
    // Check if collapse is needed
    if (segments.length > BREADCRUMB_MAX_VISIBLE) {
      const id = `breadcrumb-nav-${Math.random().toString(36).substr(2, 9)}`;

      // Show immediate parent dir + current item so context is preserved when collapsed
      const parentSegs = segments.slice(0, segments.length - 1);
      const parentPath = parentSegs.join("/");
      const parentLabel = humanize(parentSegs[parentSegs.length - 1]);
      const lastSegment = segments[segments.length - 1];
      const lastLabel_ = lastLabel ? lastLabel : humanize(lastSegment);

      let html = `<nav class="breadcrumbs" id="${id}">
        <a href="#/blog">Blog</a>
        <span class="breadcrumb-sep">/</span>
        <button class="breadcrumb-ellipsis" aria-label="Show full path" data-for="${id}">…</button>
        <span class="breadcrumb-sep">/</span>
        <a href="#/blog/dir/${parentPath}">${escapeHtml(parentLabel)}</a>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">${escapeHtml(lastLabel_)}</span>
      </nav>`;
      
      // Attach handler via event delegation after render
      setTimeout(() => {
        const navEl = document.getElementById(id);
        if (navEl) {
          const btn = navEl.querySelector(".breadcrumb-ellipsis");
          if (btn) {
            btn.addEventListener("click", function() {
              const expanded = blogBreadcrumbs(segments, options);
              navEl.outerHTML = expanded;
            });
          }
        }
      }, 0);
      
      return html;
    }
    
    // Normal breadcrumb (not collapsed)
    let html = '<nav class="breadcrumbs"><a href="#/blog">Blog</a>';
    let accum = "";
    for (let i = 0; i < segments.length; i++) {
      accum += (accum ? "/" : "") + segments[i];
      const isLast = i === segments.length - 1;
      const label = isLast && lastLabel ? lastLabel : humanize(segments[i]);
      if (isLast && !linkLast) {
        html += `<span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${escapeHtml(label)}</span>`;
      } else {
        html += `<span class="breadcrumb-sep">/</span><a href="#/blog/dir/${accum}">${escapeHtml(label)}</a>`;
      }
    }
    html += "</nav>";
    return html;
  }

  function renderPostCard(p, options = {}) {
    const coverSrc = p.cover ? resolvePath(p.cover) : "";
    const imageLoading = options.imageLoading || "lazy";
    const fetchPriority = options.fetchPriority || "auto";
    const thumbHtml = coverSrc
      ? `<div class="post-card-thumb is-loading"><img ${buildResponsiveImageAttrs(coverSrc, {
          alt: p.title || "",
          loading: imageLoading,
          fetchPriority,
          sizes: "(max-width: 480px) 100px, (max-width: 640px) 120px, 180px",
          maxSrcsetWidth: 480,
        })}></div>`
      : "";
    return `
      <a href="#/blog/post/${p.slug}" class="post-card${coverSrc ? " has-thumb" : ""}">
        ${thumbHtml}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(p.title)}</div>
          <div class="post-card-summary">${escapeHtml(p.summary || "")}</div>
          <div class="post-card-meta">
            <span class="post-card-date">${formatDate(p.date)}</span>
            ${p.category ? `<span class="post-card-category">${escapeHtml(p.category)}</span>` : ""}
            ${renderStatusChip(p.status)}
            ${(p.tags || []).map((t) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
      </a>`;
  }

  async function renderBlogDir(dirPath) {
    await Promise.all([ensureSection("blogDirs"), ensureSection("posts")]);
    const dir = state.blogDirs[dirPath];
    if (!dir) {
      showContent('<div class="empty-state"><h3>Directory not found</h3></div>');
      return;
    }

    const isRoot = dirPath === "";
    const segments = dirPath ? dirPath.split("/") : [];
    const breadcrumbsHtml = isRoot ? "" : blogBreadcrumbs(segments);
    const title = isRoot ? "Blog" : humanize(segments[segments.length - 1]);

    // Subdirectory chips (max 6 visible, collapsible rest)
    let foldersHtml = "";
    if (dir.subdirs.length) {
      const makeChip = (d) => {
        const fullDir = dirPath ? dirPath + "/" + d : d;
        const childDir = state.blogDirs[fullDir];
        const count = childDir ? childDir.posts.length : 0;
        const rawLabel = String(d || "").toLowerCase();
        const humanLabel = humanize(d).toLowerCase();
        return `<a href="#/blog/dir/${fullDir}" class="blog-dir-chip" data-subdir-name="${escapeHtml(rawLabel)}" data-subdir-human="${escapeHtml(humanLabel)}">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L8.854 4.145A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>
          <span class="blog-dir-chip-label">${escapeHtml(humanize(d))}</span>
          ${count ? `<span class="blog-dir-count">${count}</span>` : ""}
        </a>`;
      };
      const visible = dir.subdirs.slice(0, 6);
      const hidden = dir.subdirs.slice(6);
      foldersHtml = `<div class="blog-dir-folders">
        ${visible.map(makeChip).join("")}
        ${hidden.length ? `<div class="blog-dir-hidden" id="blog-dir-hidden" hidden>${hidden.map(makeChip).join("")}</div>
        <button class="blog-dir-chip more-dirs-btn" id="more-dirs-btn">+${hidden.length} more</button>` : ""}
      </div>`;
    }

    // Collect & sort posts
    const dirPosts = dir.posts
      .map((slug) => state.posts.find((p) => p.slug === slug))
      .filter(Boolean);
    const sortedPosts = getSortedItems(dirPosts, "latest");

    initPagination("blog", sortedPosts, renderPostCard);
    const initial = sortedPosts.slice(0, SEO_INITIAL_COUNT);
    _paginationState.currentIndex = initial.length;

    const total = dirPosts.length;
    const subtitle = isRoot
      ? `${state.posts.length} post${state.posts.length !== 1 ? "s" : ""}`
      : `${total} post${total !== 1 ? "s" : ""} in this directory`;

    showContent(`
      ${breadcrumbsHtml}
      <div class="page-header">
        <div>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-subtitle">${subtitle}</p>
        </div>
        ${shareButton(title)}
      </div>
      ${total > 0 || dir.subdirs.length ? dirControlsHtml() : ""}
      ${foldersHtml}
      <div class="post-list" id="paginated-list">${
        initial.map(renderPostCard).join("") ||
        '<div class="empty-state"><p>No posts in this directory.</p></div>'
      }</div>
    `);

    updatePageMeta({
      title: isRoot ? "Blog" : title,
      description: subtitle,
      robots: isRoot ? "index, follow" : "noindex, nofollow",
    });
    initShareButton(title, {
      isDirectory: true,
      pageCount: isRoot ? state.posts.length : total,
      dirPostTitles: dirPosts.slice(0, 4).map((p) => p.title),
    });
    initLazyImages();

    requestAnimationFrame(() => {
      _paginationState.itemsPerPage = computeItemsPerPage();
      if (_paginationState.currentIndex < sortedPosts.length) setupPaginationSentinel();
      const applySubdirFilter = (query) => {
        const chips = Array.from(document.querySelectorAll(".blog-dir-chip[data-subdir-name]"));
        const hiddenWrap = document.getElementById("blog-dir-hidden");
        const moreBtn = document.getElementById("more-dirs-btn");
        if (!chips.length) return;

        if (query) {
          if (hiddenWrap) hiddenWrap.hidden = false;
          if (moreBtn) moreBtn.style.display = "none";
          chips.forEach((chip) => {
            const raw = (chip.getAttribute("data-subdir-name") || "").toLowerCase();
            const human = (chip.getAttribute("data-subdir-human") || "").toLowerCase();
            chip.style.display = raw.includes(query) || human.includes(query) ? "" : "none";
          });
          return;
        }

        chips.forEach((chip) => {
          chip.style.display = "";
        });
        if (hiddenWrap) hiddenWrap.hidden = true;
        if (moreBtn) moreBtn.style.display = "";
      };

      initDirControls(dirPosts, { onQueryChange: applySubdirFilter });
      initMoreDirsButton();
    });
  }

  // __PAGES_REGION_A_START__
  // ── Content Type System ───────────────────────────────

  const contentLayouts = {
    default: {
      bodyClass: "",
      handlesCover: false,
      renderBody(body) {
        return `<div class="article-body">${renderMd(body)}</div>`;
      },
      headerLayout: "standard",
    },
    poem: {
      bodyClass: "poem-layout",
      handlesCover: true,
      renderBody(body, frontmatter) {
        const coverUrl = resolvePath(frontmatter.cover) || "";
        const coverHtml = coverUrl
          ? `<div class="poem-cover is-loading"><img ${buildDetailImageAttrs(coverUrl, {
              alt: frontmatter.title || "",
              loading: "lazy",
            })}></div>`
          : "";
        return `<div class="article-body poem-body">${coverHtml}${renderMd(body, { breaks: true })}</div>`;
      },
      headerLayout: "poem",
    },
    novel: {
      bodyClass: "novel-layout",
      handlesCover: false,
      renderBody(body, frontmatter) {
        const series = frontmatter.series || "";
        const chapter = frontmatter.chapter || "";
        const seriesHtml = series
          ? `<div class="novel-series">${escapeHtml(humanize(series))}</div>`
          : "";
        const chapterHtml = chapter
          ? `<div class="novel-chapter">Chapter ${escapeHtml(chapter)}</div>`
          : "";
        return `${seriesHtml}${chapterHtml}<div class="article-body novel-body">${renderMd(body)}</div>`;
      },
      headerLayout: "novel",
    },
    comic: {
      bodyClass: "comic-layout",
      handlesCover: true,
      isComic: true,
      renderBody() { return ""; },
      headerLayout: "standard",
    },
  };

  function getContentLayout(type) {
    return contentLayouts[type] || contentLayouts.default;
  }

  // ── Comic Page Renderer ───────────────────────────────

  async function renderComicPost(post, frontmatter) {
    const rawImages = frontmatter.images || post.images || [];
    const images = rawImages.map((img) => {
      const src = typeof img === "string" ? img : img.src || "";
      return { src: resolvePath(src), caption: (typeof img === "object" && img.caption) || "" };
    }).filter((img) => img.src);

    const modeKey = `comic-mode-${post.slug}`;
    const mode = sessionStorage.getItem(modeKey) || "scroll";

    const tagsHtml = (post.tags || [])
      .map((t) => `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`)
      .join("");
    const slugParts = post.slug.split("/");
    const parentDir = slugParts.length > 1 ? slugParts.slice(0, -1).join("/") : "";
    const backHref = parentDir ? `#/blog/dir/${parentDir}` : "#/blog";
    const backLabel = parentDir ? humanize(slugParts[slugParts.length - 2]) : "blog";

    showContent(`
      <div class="article-top-bar">
        <a href="${backHref}" class="back-link">\u2190 Back to ${escapeHtml(backLabel)}</a>
        ${shareButton(post.title)}
      </div>
      <div class="article-header">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta">
          <span class="post-card-date">${formatDate(post.date)}</span>
          ${tagsHtml}
        </div>
      </div>
      <div class="comic-controls">
        <label class="comic-mode-label" for="comic-mode-select">Mode</label>
        <select id="comic-mode-select" class="comic-mode-select" aria-label="Display mode">
          <option value="scroll"${mode === "scroll" ? " selected" : ""}>Scroll</option>
          <option value="swipe"${mode === "swipe" ? " selected" : ""}>Swipe</option>
        </select>
      </div>
      <div id="comic-viewer" class="comic-viewer" data-mode="${mode}">
        ${mode === "scroll" ? buildComicScrollHtml(images) : buildComicSwipeHtml(images, 0)}
      </div>
      <button class="scroll-to-top-btn" id="scroll-to-top" aria-label="Scroll to top">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    `);

    updatePageMeta({ title: post.title, description: post.summary || "" });
    initShareButton(post.title, { author: frontmatter.author });
    initComicPage(modeKey, images);
  }

  function buildComicScrollHtml(images) {
    if (!images.length) return '<div class="empty-state"><p>No images found.</p></div>';
    return images
      .map(
        (img) => `<div class="comic-image-wrap is-loading">
          <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.caption)}" loading="lazy" decoding="async">
        </div>`,
      )
      .join("");
  }

  function buildComicSwipeHtml(images, idx) {
    if (!images.length) return '<div class="empty-state"><p>No images found.</p></div>';
    const img = images[idx];
    const total = images.length;
    return `<div class="comic-swipe-container">
      <div class="comic-image-wrap is-loading">
        <img id="comic-swipe-img" src="${escapeHtml(img.src)}" alt="${escapeHtml(img.caption)}" loading="eager" decoding="async">
      </div>
      <button class="comic-swipe-btn prev" aria-label="Previous image">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="comic-swipe-btn next" aria-label="Next image">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="comic-swipe-counter" id="comic-swipe-counter">${idx + 1} / ${total}</div>`;
  }

  function initComicPage(modeKey, images) {
    let swipeIndex = 0;

    // Mode switcher
    const modeSelect = document.getElementById("comic-mode-select");
    const viewer = document.getElementById("comic-viewer");
    if (modeSelect && viewer) {
      modeSelect.addEventListener("change", () => {
        const newMode = modeSelect.value;
        sessionStorage.setItem(modeKey, newMode);
        viewer.dataset.mode = newMode;
        swipeIndex = 0;
        viewer.innerHTML = newMode === "scroll"
          ? buildComicScrollHtml(images)
          : buildComicSwipeHtml(images, 0);
        initComicSwipeButtons(images, swipeIndex, (i) => { swipeIndex = i; });
        initLazyImages();
      });
    }

    initComicSwipeButtons(images, swipeIndex, (i) => { swipeIndex = i; });

    // Scroll-to-top
    const topBtn = document.getElementById("scroll-to-top");
    if (topBtn) {
      const onScroll = () => {
        topBtn.style.display = window.scrollY > 300 ? "flex" : "none";
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
      onScroll();
    }

    // Hide images that fail to load
    document.querySelectorAll(".comic-image-wrap img").forEach((img) => {
      img.addEventListener("error", () => {
        const wrap = img.closest(".comic-image-wrap");
        if (wrap) wrap.style.display = "none";
      });
    });

    initLazyImages();
  }

  function initComicSwipeButtons(images, startIndex, onIndexChange) {
    const viewer = document.getElementById("comic-viewer");
    if (!viewer || viewer.dataset.mode !== "swipe") return;

    let idx = startIndex;

    function navigate(delta) {
      idx = (idx + delta + images.length) % images.length;
      onIndexChange(idx);
      const imgEl = document.getElementById("comic-swipe-img");
      const counter = document.getElementById("comic-swipe-counter");
      const img = images[idx];
      if (imgEl) {
        imgEl.src = escapeHtml(img.src);
        imgEl.alt = escapeHtml(img.caption);
      }
      if (counter) counter.textContent = `${idx + 1} / ${images.length}`;
    }

    viewer.querySelector(".comic-swipe-btn.prev")?.addEventListener("click", () => navigate(-1));
    viewer.querySelector(".comic-swipe-btn.next")?.addEventListener("click", () => navigate(1));
  }

  function readingModeButton() {
    return `<button class="reading-mode-btn" aria-label="Reading Mode">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M2 6.5h12M2 10h8M2 13.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span>Read</span>
    </button>`;
  }

  function initReadingMode(frontmatter) {
    const btn = document.querySelector(".reading-mode-btn");
    if (!btn) return;
    const autoEnable =
      frontmatter &&
      (frontmatter.readingMode === "true" || frontmatter.readingMode === true);
    if (autoEnable) {
      document.body.classList.add("reading-mode");
      btn.querySelector("span").textContent = "Exit";
    }
    btn.addEventListener("click", () => {
      document.body.classList.toggle("reading-mode");
      const active = document.body.classList.contains("reading-mode");
      btn.querySelector("span").textContent = active ? "Exit" : "Read";
    });
  }

  function scrollToId(id, smooth = true) {
    const delays = [80, 250, 600];
    function attempt(i) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        return;
      }
      if (i < delays.length) setTimeout(() => attempt(i + 1), delays[i]);
    }
    attempt(0);
  }

  function scrollToAnchor() {
    const anchor =
      window.location.hash && !window.location.hash.startsWith("#/")
        ? decodeURIComponent(window.location.hash.slice(1))
        : "";
    if (!anchor) return;
    scrollToId(anchor);
  }

  function initContentLinks() {
    normalizeLegacyRouteLinks(document.getElementById("page-content"));
  }

  async function renderBlogPost(slug) {
    showLoading();
    await ensureSection("posts");
    const post = state.posts.find((p) => p.slug === slug);
    if (!post) {
      showContent('<div class="empty-state"><h3>Post not found</h3></div>');
      return;
    }
    try {
      await ensureImageManifest();
      const raw = await loadMarkdown(post.path);
      const { frontmatter, body } = parseMarkdown(raw);
      const readTime = Math.max(
        1,
        Math.ceil(body.trim().split(/\s+/).length / 200),
      );
      const type = frontmatter.type || post.type || "default";
      const layout = getContentLayout(type);

      if (layout.isComic) {
        await renderComicPost(post, frontmatter);
        return;
      }

      const bodyHtml = layout.renderBody(body, frontmatter);
      const tagsHtml = (post.tags || [])
        .map(
          (t) =>
            `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`,
        )
        .join("");

      const slugParts = slug.split("/");
      const parentDir =
        slugParts.length > 1 ? slugParts.slice(0, -1).join("/") : "";
      const backHref = parentDir ? `#/blog/dir/${parentDir}` : "#/blog";
      const backLabel = parentDir
        ? humanize(slugParts[slugParts.length - 2])
        : "blog";
      const breadcrumbsHtml =
        slugParts.length > 1
          ? blogBreadcrumbs(slugParts, {
              linkLast: false,
              lastLabel: post.title,
            })
          : "";

      const np = frontmatter.next_page;
      const pp = frontmatter.previous_page;
      let nextPage =
        Array.isArray(np) && np.length
          ? np[0]
          : typeof np === "object" && np
            ? np
            : null;
      let prevPage =
        Array.isArray(pp) && pp.length
          ? pp[0]
          : typeof pp === "object" && pp
            ? pp
            : null;

      // Auto-compute prev/next from chapter order when not in frontmatter (only for novel and comic types)
      if (!nextPage && !prevPage && (type === "novel" || type === "comic")) {
        const dir = post.dir || "";
        const dirData = state.blogDirs && state.blogDirs[dir];
        if (dirData && dirData.posts && dirData.posts.length > 1) {
          const siblings = dirData.posts
            .map(s => state.posts.find(p => p.slug === s))
            .filter(Boolean)
            .sort((a, b) => {
              const ca = parseInt(a.chapter) || 0, cb = parseInt(b.chapter) || 0;
              return ca !== cb ? ca - cb : new Date(a.date) - new Date(b.date);
            });
          const idx = siblings.findIndex(p => p.slug === slug);
          if (idx > 0) {
            const prev = siblings[idx - 1];
            prevPage = { title: prev.title, link: `/blog/post/${prev.slug.split("/").map(encodeURIComponent).join("/")}` };
          }
          if (idx >= 0 && idx < siblings.length - 1) {
            const next = siblings[idx + 1];
            nextPage = { title: next.title, link: `/blog/post/${next.slug.split("/").map(encodeURIComponent).join("/")}` };
          }
        }
      }
      let postNavHtml = "";
      if (prevPage || nextPage) {
        // Resolve content-relative links (e.g. /blog/x → /blog/post/x) and
        // encode any special characters in path segments so the href is valid.
        function resolveNavLink(link) {
          if (!link) return link;
          const resolved = resolveContentLink(link);
          // Encode each path segment, preserving existing percent-encoding
          return resolved.split("/").map((seg) => {
            try { seg = decodeURIComponent(seg); } catch { /* keep */ }
            return encodeURIComponent(seg);
          }).join("/").replace(/^%2F/, "/"); // keep leading slash
        }
        postNavHtml = '<div class="post-nav">';
        if (prevPage && prevPage.link) {
          postNavHtml += `<a href="${escapeHtml(resolveNavLink(prevPage.link))}" class="post-nav-link prev">
            <span class="post-nav-label">\u2190 Previous</span>
            <span class="post-nav-title">${escapeHtml(prevPage.title || "Previous Page")}</span>
          </a>`;
        } else {
          postNavHtml += "<div></div>";
        }
        if (nextPage && nextPage.link) {
          postNavHtml += `<a href="${escapeHtml(resolveNavLink(nextPage.link))}" class="post-nav-link next">
            <span class="post-nav-label">Next \u2192</span>
            <span class="post-nav-title">${escapeHtml(nextPage.title || "Next Page")}</span>
          </a>`;
        }
        postNavHtml += "</div>";
      }

      const headerHtml =
        layout.headerLayout === "poem"
          ? `<div class="article-header poem-header">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
              <span class="post-card-date">${formatDate(post.date)}</span>
              ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ""}
              ${renderStatusChip(frontmatter.status || post.status)}
              ${tagsHtml}
            </div>
          </div>`
          : `<div class="article-header">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
              <span class="post-card-date">${formatDate(post.date)}</span>
              ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ""}
              ${renderStatusChip(frontmatter.status || post.status)}
              ${tagsHtml}
            </div>
          </div>`;

      const coverUrl = resolvePath(frontmatter.cover || post.cover) || "";
      const coverHtml =
        coverUrl && !layout.handlesCover
          ? `<div class="article-cover is-loading"><img ${buildDetailImageAttrs(coverUrl, {
              alt: frontmatter.title || "",
              loading: "lazy",
            })}></div>`
          : "";

      const showGiscus = shouldShowGiscus(frontmatter, "blog");
      const giscusHtml = showGiscus
        ? '<div class="giscus-container"><div id="giscus-sentinel"></div></div>'
        : "";

      if (layout.bodyClass)
        document
          .getElementById("page-content")
          .setAttribute("data-layout", type);
      else
        document.getElementById("page-content").removeAttribute("data-layout");

      showContent(`
        ${breadcrumbsHtml}
        <div class="article-top-bar">
          <a href="${backHref}" class="back-link">\u2190 Back to ${escapeHtml(backLabel)}</a>
          <div style="display:flex;gap:8px;align-items:center">
            ${readingModeButton()}
            ${shareButton(post.title)}
          </div>
        </div>
        ${headerHtml}
        ${coverHtml}
        ${bodyHtml}
        ${postNavHtml}
        ${giscusHtml}
        ${contentFooter(frontmatter.author)}
      `);
      updatePageMeta({
        title: post.title,
        description: post.summary || "",
        image: coverUrl || "",
        type: "article",
        author: frontmatter.author || "",
        keywords: post.tags || [],
        structuredData: {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.date,
          dateModified: post.date,
          author: {
            "@type": "Person",
            name:
              frontmatter.author ||
              (state.config && state.config.author) ||
              "",
          },
          mainEntityOfPage: getAbsolutePageUrl(`/blog/post/${post.slug}`),
          image: coverUrl || undefined,
        },
      });
      initShareButton(post.title, {
        coverUrl,
        author: frontmatter.author,
        readTime,
        summary: post.summary,
        category: post.category,
        tags: post.tags,
      });
      initReadingMode(frontmatter);
      initArticleImages();
      initSortableTables();
      initContentLinks();
      scrollToAnchor();
      if (showGiscus) initGiscus(`/blog/post/${slug}`);
    } catch {
      showContent(
        '<div class="empty-state"><h3>Failed to load post</h3></div>',
      );
    }
  }

  // ── Portfolio ─────────────────────────────────────────

  function renderPortfolioCard(p) {
    const tagsHtml = (p.tags || [])
      .map(
        (t) =>
          `<span class="tag" style="padding:3px 10px;font-size:11px">${escapeHtml(t)}</span>`,
      )
      .join("");
    const links = [];
    if (p.github)
      links.push(
        `<a href="${escapeHtml(p.github)}" class="btn-github" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>`,
      );
    if (p.demo)
      links.push(
        `<a href="${escapeHtml(p.demo)}" class="btn-demo" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Demo</a>`,
      );
    return `
      <div class="portfolio-card" data-href="#/portfolio/${p.slug}">
        <div class="portfolio-card-title">${escapeHtml(p.title)}</div>
        <div class="portfolio-card-summary">${escapeHtml(p.summary || "")}</div>
        <div class="portfolio-card-meta-row">${renderStatusChip(p.status)}</div>
        <div class="portfolio-card-tags">${tagsHtml}</div>
        ${links.length ? `<div class="portfolio-card-links">${links.join("")}</div>` : ""}
      </div>`;
  }

  async function renderPortfolioList() {
    await ensureSection("portfolio");
    const allItems = [...state.portfolio];
    let currentSort = "latest";
    let currentQuery = "";
    const subtitle = `${state.portfolio.length} project${state.portfolio.length !== 1 ? "s" : ""}`;

    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Portfolio</h1>
          <p class="page-subtitle">${subtitle}</p>
        </div>
        ${shareButton("Portfolio")}
      </div>
      ${allItems.length > 0 ? dirControlsHtml() : ""}
      <div id="portfolio-timeline-root"></div>
    `);
    updatePageMeta({ title: "Portfolio" });
    initShareButton("Portfolio", {
      isDirectory: true,
      pageCount: state.portfolio.length,
      dirPostTitles: getSortedItems(allItems, currentSort).slice(0, 4).map((p) => p.title),
      pageLabel: "project",
    });

    function applyPortfolioFilters() {
      const query = currentQuery.toLowerCase();
      const filtered = allItems.filter((item) => {
        if (!query) return true;
        return (
          (item.title || "").toLowerCase().includes(query) ||
          (item.summary || "").toLowerCase().includes(query) ||
          (item.category || "").toLowerCase().includes(query) ||
          (item.tags || []).some((t) => String(t).toLowerCase().includes(query))
        );
      });
      const sorted = getSortedItems(filtered, currentSort);
      const root = document.getElementById("portfolio-timeline-root");
      if (!root) return;
      root.innerHTML =
        sorted.length > 0
          ? renderPortfolioTimeline(sorted, currentSort)
          : '<div class="empty-state"><p>No projects match your query.</p></div>';
      initPortfolioCards();
      initLazyImages();
    }

    const searchInput = document.getElementById("dir-search");
    const sortSelect = document.getElementById("dir-sort");
    if (searchInput) {
      searchInput.placeholder = "Search projects...";
      searchInput.addEventListener("input", () => {
        currentQuery = searchInput.value.trim();
        applyPortfolioFilters();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentSort = sortSelect.value || "latest";
        applyPortfolioFilters();
      });
    }

    applyPortfolioFilters();
  }

  function getPortfolioTimelineKey(item, sort) {
    if (sort === "az" || sort === "za") {
      const title = (item.title || "").trim();
      const ch = title ? title.charAt(0).toUpperCase() : "#";
      return /[A-Z]/.test(ch) ? ch : "#";
    }
    if (!item.date || item.date === "1970-01-01") return "Other";
    const year = new Date(`${item.date}T00:00:00`).getFullYear();
    return Number.isFinite(year) ? String(year) : "Other";
  }

  function renderPortfolioTimeline(items, sort) {
    const groups = [];
    const groupMap = new Map();
    items.forEach((item) => {
      const key = getPortfolioTimelineKey(item, sort);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groups.push(key);
      }
      groupMap.get(key).push(item);
    });

    const timelineHtml = groups
      .map((key) => {
        const itemsHtml = (groupMap.get(key) || [])
          .map((p) => `<div class="timeline-item">${renderPortfolioCard(p)}</div>`)
          .join("");
        return `<div class="timeline-year"><div class="timeline-year-label">${escapeHtml(key)}</div>${itemsHtml}</div>`;
      })
      .join("");

    return `<div class="timeline">${timelineHtml}</div>`;
  }

  function initPortfolioCards() {
    document.querySelectorAll(".portfolio-card[data-href]").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        navigateTo(card.dataset.href);
      });
    });
  }

  async function renderPortfolioItem(slug) {
    showLoading();
    await ensureSection("portfolio");
    const item = state.portfolio.find((p) => p.slug === slug);
    if (!item) {
      showContent('<div class="empty-state"><h3>Project not found</h3></div>');
      return;
    }
    try {
      await ensureImageManifest();
      const raw = await loadMarkdown(item.path);
      const { frontmatter, body } = parseMarkdown(raw);
      const readTime = Math.max(
        1,
        Math.ceil(body.trim().split(/\s+/).length / 200),
      );
      const html = renderMd(body);
      const tagsHtml = (item.tags || [])
        .map(
          (t) =>
            `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`,
        )
        .join("");
      const links = [];
      if (item.github)
        links.push(
          `<a href="${escapeHtml(item.github)}" class="btn-github" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>`,
        );
      if (item.demo)
        links.push(
          `<a href="${escapeHtml(item.demo)}" class="btn-demo" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Live Demo</a>`,
        );
      const showGiscusPortfolio = shouldShowGiscus(frontmatter, "portfolio");
      const giscusPortfolioHtml = showGiscusPortfolio
        ? '<div class="giscus-container"><div id="giscus-sentinel"></div></div>'
        : "";

      document.getElementById("page-content").removeAttribute("data-layout");
      showContent(`
        <div class="article-top-bar">
          <a href="#/portfolio" class="back-link">\u2190 Back to portfolio</a>
          ${shareButton(item.title)}
        </div>
        <div class="article-header">
          <h1>${escapeHtml(item.title)}</h1>
          <div class="article-meta">
            ${item.category ? `<span class="post-card-category">${escapeHtml(item.category)}</span>` : ""}
            ${renderStatusChip(frontmatter.status || item.status)}
            ${tagsHtml}
          </div>
          ${links.length ? `<div class="portfolio-detail-links">${links.join("")}</div>` : ""}
        </div>
        <div class="article-body">${html}</div>
        ${giscusPortfolioHtml}
        ${contentFooter(frontmatter.author)}
      `);
      const portfolioCoverUrl = resolvePath(frontmatter.cover || item.cover) || "";
      updatePageMeta({
        title: item.title,
        description: item.summary || "",
        image: portfolioCoverUrl,
        type: "article",
        author: frontmatter.author || "",
        keywords: item.tags || [],
      });
      initShareButton(item.title, {
        author: frontmatter.author,
        readTime,
        summary: item.summary,
        category: item.category,
        tags: item.tags,
        isPortfolioDetail: true,
      });
      initArticleImages();
      initSortableTables();
      initContentLinks();
      scrollToAnchor();
      if (showGiscusPortfolio) initGiscus(`/portfolio/${slug}`);
    } catch {
      showContent(
        '<div class="empty-state"><h3>Failed to load project</h3></div>',
      );
    }
  }

  // ── Gallery ───────────────────────────────────────────

  async function renderGallery(autoOpenIndex) {
    await Promise.all([ensureSection("gallery"), ensureImageManifest()]);
    const shareIconSvg =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const items = state.gallery
      .map((g, galleryIndex) => {
        const images = getGalleryImages(g);
        if (!images.length) return "";
        const imgSrc = resolvePath(images[0].src);
        const isMulti = images.length > 1;
        const isAboveFold = galleryIndex < 2;
        const countBadge = isMulti
          ? `<div class="gallery-image-count"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="9" height="9" rx="1.5"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>${images.length}</div>`
          : "";
        const desc = g.description || "";
        const hasLongDesc = desc.length > 120;
        return `
      <div class="gallery-card${isMulti ? " multi-image" : ""}">
        <div class="gallery-card-img is-loading" onclick="window.__openGallery(${galleryIndex})">
          <img ${buildResponsiveImageAttrs(imgSrc, {
            alt: g.title,
            loading: isAboveFold ? "eager" : "lazy",
            fetchPriority: isAboveFold ? "high" : "auto",
            sizes: "(max-width: 640px) calc(100vw - 32px), 600px",
          })}>
          ${countBadge}
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-header">
            <div class="gallery-card-title">${escapeHtml(g.title)}</div>
            <button class="gallery-share-btn" data-gallery-index="${galleryIndex}" data-gallery-title="${escapeHtml(g.title)}" aria-label="Share image">${shareIconSvg}</button>
          </div>
          ${g.caption ? `<div class="gallery-card-caption">${escapeHtml(g.caption)}</div>` : ""}
          ${
            desc
              ? `<div class="gallery-card-desc${hasLongDesc ? " collapsed" : ""}">
            <div class="gallery-card-desc-text">${escapeHtml(desc)}</div>
            ${hasLongDesc ? '<button class="gallery-card-toggle">Show more</button>' : ""}
          </div>`
              : ""
          }
          <div class="gallery-card-footer"><div class="gallery-card-date">${formatDate(g.date)}</div></div>
        </div>
      </div>`;
      })
      .join("");

    const galleryImageUrls = state.gallery
      .slice(0, 4)
      .map((g) => {
        const imgs = getGalleryImages(g);
        return imgs.length ? resolvePath(imgs[0].src) : "";
      })
      .filter(Boolean);

    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Gallery</h1>
          <p class="page-subtitle">${state.gallery.length} photo${state.gallery.length !== 1 ? "s" : ""}</p>
        </div>
        ${shareButton("Gallery")}
      </div>
      <div class="gallery-list">${items}</div>
    `);
    updatePageMeta({
      title: "Gallery",
      image: galleryImageUrls[0] || "",
      robots: "noindex, nofollow",
    });
    initShareButton("Gallery", {
      isGallery: true,
      galleryImageUrls,
      galleryCount: state.gallery.length,
    });
    initGalleryToggles();
    initGalleryShareButtons();
    initLazyImages();
    if (typeof autoOpenIndex === "number" && autoOpenIndex >= 0) {
      setTimeout(() => window.__openGallery(autoOpenIndex), 100);
    }
  }

  function initGalleryToggles() {
    document.querySelectorAll(".gallery-card-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const desc = btn.closest(".gallery-card-desc");
        const isCollapsed = desc.classList.toggle("collapsed");
        btn.textContent = isCollapsed ? "Show more" : "Show less";
      });
    });
  }

  function initGalleryShareButtons() {
    document.querySelectorAll(".gallery-share-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = btn.dataset.galleryIndex;
        const title = btn.dataset.galleryTitle;
        const url = getAbsolutePageUrl(`/gallery/${idx}`);
        navigator.clipboard
          .writeText(title + " : " + url)
          .then(() => {
            btn.classList.add("copied");
            setTimeout(() => btn.classList.remove("copied"), 2000);
          })
          .catch(() => {});
      });
    });
  }

  // ── Thoughts ──────────────────────────────────────────

  function renderThoughtCard(t) {
    const tagsHtml = (t.tags || [])
      .map(
        (tag) =>
          `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(tag)}</span>`,
      )
      .join("");
    return `
      <div class="thought-card">
        <div class="thought-body">${escapeHtml(t.body)}</div>
        <div class="thought-meta">
          <span class="thought-title">${escapeHtml(t.title)}</span>
          <span>\u00B7</span>
          <span class="post-card-date">${formatDate(t.date)}</span>
          ${tagsHtml}
        </div>
      </div>`;
  }

  async function renderThoughts() {
    await ensureSection("thoughts");
    const allItems = getSortedItems(state.thoughts, "latest");

    initPagination("thoughts", allItems, renderThoughtCard);
    const initial = allItems.slice(0, SEO_INITIAL_COUNT);
    _paginationState.currentIndex = initial.length;

    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Shower Thoughts</h1>
          <p class="page-subtitle">Random ideas that pop in my mind</p>
        </div>
        ${shareButton("Shower Thoughts")}
      </div>
      ${allItems.length > 0 ? dirControlsHtml() : ""}
      <div class="thoughts-list" id="paginated-list">${
        initial.map(renderThoughtCard).join("") ||
        '<div class="empty-state"><p>No thoughts yet. Brain empty.</p></div>'
      }</div>
    `);
    updatePageMeta({
      title: "Shower Thoughts",
      description: "Random ideas that pop in my mind",
      robots: "noindex, nofollow",
    });
    initShareButton("Shower Thoughts", { isThoughts: true });
    initLazyImages();

    requestAnimationFrame(() => {
      _paginationState.itemsPerPage = computeItemsPerPage();
      if (_paginationState.currentIndex < allItems.length) setupPaginationSentinel();
      initDirControls(allItems);
    });
  }

  // ── Shared filtered item renderer ─────────────────────

  function itemHref(item) {
    if (item.section === "blog") return `/blog/post/${item.slug}`;
    if (item.section === "portfolio") return `/portfolio/${item.slug}`;
    if (item.section === "gallery") return "/gallery";
    if (item.section === "thoughts") return "/thoughts";
    return `/${item.slug}`;
  }

  function renderFilteredItem(item) {
    const sectionLabel = item.section
      ? `<span class="post-card-category">${escapeHtml(item.section)}</span>`
      : "";
    const coverSrc = item.cover ? resolvePath(item.cover) : "";
    const thumbHtml = coverSrc
      ? `<div class="post-card-thumb is-loading"><img ${buildResponsiveImageAttrs(coverSrc, {
          alt: item.title || "",
          loading: "lazy",
          sizes: "(max-width: 480px) 100px, (max-width: 640px) 120px, 180px",
          maxSrcsetWidth: 480,
        })}></div>`
      : "";
    return `
      <a href="${itemHref(item)}" class="post-card${coverSrc ? " has-thumb" : ""}">
        ${thumbHtml}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(item.title)}</div>
          <div class="post-card-summary">${escapeHtml(item.summary || item.body || "")}</div>
          <div class="post-card-meta">
            ${item.date ? `<span class="post-card-date">${formatDate(item.date)}</span>` : ""}
            ${sectionLabel}
          </div>
        </div>
      </a>`;
  }

  // ── Tags & Categories ─────────────────────────────────

  async function renderTags() {
    await ensureSection("tags");
    updatePageMeta({ title: "Tags", robots: "noindex, nofollow" });
    const sorted = Object.entries(state.tags).sort((a, b) => b[1] - a[1]);
    const tagsHtml = sorted
      .map(
        ([tag, count]) =>
          `<a href="#/tag/${encodeURIComponent(tag)}" class="tag">${escapeHtml(tag)} <span class="tag-count">${count}</span></a>`,
      )
      .join("");
    showContent(
      `<h1 class="page-title">Tags</h1><p class="page-subtitle">${sorted.length} tag${sorted.length !== 1 ? "s" : ""}</p><div class="tag-cloud">${tagsHtml}</div>`,
    );
  }

  async function renderTagPosts(tag) {
    await Promise.all([
      ensureSection("posts"),
      ensureSection("portfolio"),
      ensureSection("gallery"),
      ensureSection("thoughts"),
      ensureSection("tags"),
    ]);
    updatePageMeta({
      title: `Tag: ${tag}`,
      keywords: [tag],
      robots: "noindex, nofollow",
    });
    const allItems = [
      ...state.posts,
      ...state.portfolio,
      ...state.gallery,
      ...state.thoughts,
    ];
    const filtered = allItems.filter((p) => (p.tags || []).includes(tag));
    const html = filtered.map((item) => renderFilteredItem(item)).join("");
    showContent(`
      <a href="#/tags" class="back-link">\u2190 All tags</a>
      <h1 class="page-title">Tag: ${escapeHtml(tag)}</h1>
      <p class="page-subtitle">${filtered.length} item${filtered.length !== 1 ? "s" : ""}</p>
      <div class="post-list">${html || '<div class="empty-state"><p>No items with this tag.</p></div>'}</div>
    `);
    initLazyImages();
  }

  async function renderCategories() {
    await ensureSection("categories");
    updatePageMeta({ title: "Categories", robots: "noindex, nofollow" });
    const sorted = Object.entries(state.categories).sort((a, b) => b[1] - a[1]);
    const html = sorted
      .map(
        ([cat, count]) =>
          `<a href="#/category/${encodeURIComponent(cat)}" class="tag">${escapeHtml(cat)} <span class="tag-count">${count}</span></a>`,
      )
      .join("");
    showContent(
      `<h1 class="page-title">Categories</h1><p class="page-subtitle">${sorted.length} categor${sorted.length !== 1 ? "ies" : "y"}</p><div class="tag-cloud">${html}</div>`,
    );
  }

  async function renderCategoryPosts(category) {
    await Promise.all([
      ensureSection("posts"),
      ensureSection("portfolio"),
      ensureSection("gallery"),
      ensureSection("thoughts"),
      ensureSection("categories"),
    ]);
    updatePageMeta({
      title: `Category: ${category}`,
      keywords: [category],
      robots: "noindex, nofollow",
    });
    const allItems = [
      ...state.posts,
      ...state.portfolio,
      ...state.gallery,
      ...state.thoughts,
    ];
    const filtered = allItems.filter((p) => p.category === category);
    const html = filtered.map((item) => renderFilteredItem(item)).join("");
    showContent(`
      <a href="#/categories" class="back-link">\u2190 All categories</a>
      <h1 class="page-title">Category: ${escapeHtml(category)}</h1>
      <p class="page-subtitle">${filtered.length} item${filtered.length !== 1 ? "s" : ""}</p>
      <div class="post-list">${html || '<div class="empty-state"><p>No items in this category.</p></div>'}</div>
    `);
    initLazyImages();
  }

  // ── Profile (Parallax Hero) ───────────────────────────

  async function renderProfile() {
    const el = document.getElementById("page-content");
    const isPrerendered = el && el.dataset.prerendered === "profile";
    if (!isPrerendered) {
      showLoading();
    }
    await ensureSection("pages");
    const page = state.pages.find((p) => p.slug === "profile");
    const filePath = page ? page.path : "content/pages/profile.md";
    try {
      const raw = await loadMarkdown(filePath);
      const { frontmatter, body } = parseMarkdown(raw);
      const html = renderMd(body);

      const coverUrl =
        resolvePath(frontmatter.cover) ||
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80";
      const avatarUrl = resolvePath(frontmatter.avatar) || "";
      const name = frontmatter.title || "Profile";
      const role = frontmatter.role || "";

      const linkDefs = {
        github: { label: "GitHub", prefix: "" },
        linkedin: { label: "LinkedIn", prefix: "" },
        medium: { label: "Medium", prefix: "" },
        twitter: { label: "Twitter", prefix: "" },
        website: { label: "Website", prefix: "" },
        email: { label: "Email", prefix: "mailto:" },
      };
      const links = [];
      for (const [key, def] of Object.entries(linkDefs)) {
        if (frontmatter[key])
          links.push(
            `<a href="${def.prefix}${escapeHtml(frontmatter[key])}" target="_blank" rel="noopener">${def.label}</a>`,
          );
      }

      const metaItems = Array.isArray(frontmatter.metadata)
        ? frontmatter.metadata
        : [];
      let metaHtml = "";
      if (metaItems.length) {
        metaHtml =
          '<div class="profile-metadata">' +
          metaItems
            .map((m) => {
              if (typeof m === "string")
                return `<span class="profile-meta-chip">${escapeHtml(m)}</span>`;
              const label = m.label || "";
              const value = m.value || "";
              const url = m.url || "";
              const display = value || label;
              if (url)
                return `<a href="${escapeHtml(url)}" class="profile-meta-chip has-link" target="_blank" rel="noopener">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ""}${escapeHtml(display !== label ? display : "")}</a>`;
              return `<span class="profile-meta-chip">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ""}${escapeHtml(display !== label ? display : "")}</span>`;
            })
            .join("") +
          "</div>";
      }

      const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg></div>`;

      if (isPrerendered) {
        // Content already in DOM — clear flag and reset any transition styles
        delete el.dataset.prerendered;
        el.style.opacity = "";
        el.style.transform = "";
        el.style.transition = "";
      } else {
        showContent(`
          <div class="profile-hero" id="profile-hero">
            <div class="profile-hero-bg" id="profile-hero-bg" data-src="${escapeHtml(coverUrl)}"></div>
            <div class="profile-hero-skeleton"></div>
            <div class="profile-hero-overlay"></div>
            <div class="profile-hero-share">${shareButton(name)}</div>
            <div class="profile-hero-content">
              ${avatarUrl ? `<div class="profile-avatar-wrap is-loading"><img ${buildResponsiveImageAttrs(avatarUrl, {
                alt: name,
                className: "profile-avatar",
                loading: "eager",
                sizes: "110px",
              })}></div>` : ""}
              <div class="profile-info">
                <h1>${escapeHtml(name)}</h1>
                ${role ? `<div class="profile-role">${escapeHtml(role)}</div>` : ""}
                ${links.length ? `<div class="profile-links">${links.join("")}</div>` : ""}
              </div>
            </div>
            ${waveSvg}
          </div>
          ${metaHtml}
          <div class="article-body">${html}</div>
        `);
      }
      initParallax();
      const metaForShare = metaItems
        .slice(0, 3)
        .map((m) =>
          typeof m === "string"
            ? { label: m, value: "" }
            : { label: m.label || "", value: m.value || "" },
        );
      updatePageMeta({
        title: name !== "Profile" ? name : null,
        description: frontmatter.summary || frontmatter.description || frontmatter.bio || role || "",
        image: coverUrl || "",
        author: name !== "Profile" ? name : "",
      });
      initShareButton(name, {
        isProfile: true,
        coverUrl,
        avatarUrl,
        role,
        metadata: metaForShare,
      });
      initProfileMedia(coverUrl);
      initArticleImages();
      initSortableTables();
    } catch (err) {
      console.error("renderProfile error:", err);
      showContent('<div class="empty-state"><h3>Profile not found</h3></div>');
    }
  }

  function initProfileMedia(coverUrl) {
    const bg = document.getElementById("profile-hero-bg");
    const skeleton = document.querySelector(".profile-hero-skeleton");
    if (bg && coverUrl) {
      const img = new Image();
      img.onload = () => {
        bg.style.backgroundImage = `url('${coverUrl}')`;
        bg.style.setProperty("--profile-hero-image", `url('${coverUrl}')`);
        bg.classList.add("loaded");
        if (skeleton) skeleton.classList.add("hidden");
      };
      img.onerror = () => {
        if (skeleton) skeleton.classList.add("hidden");
      };
      img.src = coverUrl;
    }

    const avatarWrap = document.querySelector(".profile-avatar-wrap");
    const avatar = avatarWrap && avatarWrap.querySelector(".profile-avatar");
    if (avatar) {
      if (avatar.complete && avatar.naturalWidth > 0) {
        avatarWrap.classList.remove("is-loading");
        avatarWrap.classList.add("loaded", "is-loaded");
      } else {
        avatar.addEventListener(
          "load",
          () => {
            avatarWrap.classList.remove("is-loading");
            avatarWrap.classList.add("loaded", "is-loaded");
          },
          { once: true },
        );
        avatar.addEventListener(
          "error",
          () => {
            avatarWrap.classList.remove("is-loading");
            avatarWrap.classList.add("loaded", "is-loaded");
          },
          { once: true },
        );
      }
    }
  }

  // __PAGES_REGION_A_END__

  let _parallaxCleanup = null;

  function initParallax() {
    if (_parallaxCleanup) {
      _parallaxCleanup();
      _parallaxCleanup = null;
    }
    const heroBg =
      document.getElementById("profile-hero-bg") ||
      document.getElementById("home-hero-bg");
    if (!heroBg) return;
    const hero = heroBg.parentElement;
    let heroTop = 0;
    let heroHeight = 0;
    let ticking = false;
    let measureTicking = false;
    let lastDelta = Number.NaN;

    const measureHero = () => {
      // Measure on the next frame to avoid forcing sync layout right after DOM writes.
      if (measureTicking) return;
      measureTicking = true;
      requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        heroTop = window.scrollY + rect.top;
        heroHeight = rect.height;
        measureTicking = false;
      });
    };

    const updateParallax = () => {
      if (!heroHeight) return;
      const scrollTop = window.scrollY;
      const viewportBottom = scrollTop + window.innerHeight;
      if (viewportBottom >= heroTop && scrollTop <= heroTop + heroHeight) {
        const delta = scrollTop - heroTop;
        if (Math.abs(delta - lastDelta) < 0.5) return;
        lastDelta = delta;
        heroBg.style.transform = `translate3d(0, ${-delta * 0.35}px, 0) scale(1.1)`;
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateParallax();
        ticking = false;
      });
    };
    const onResize = () => {
      measureHero();
      onScroll();
    };
    measureHero();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    if (typeof ResizeObserver === "function") {
      const resizeObserver = new ResizeObserver(() => onResize());
      resizeObserver.observe(hero);
      _parallaxCleanup = () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        resizeObserver.disconnect();
      };
    } else {
      _parallaxCleanup = () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      };
    }
    requestAnimationFrame(onScroll);
  }

  // __PAGES_REGION_B_START__
  // ── Generic Page ──────────────────────────────────────

  async function renderPage(slug) {
    showLoading();
    await Promise.all([ensureSection("pages"), ensureSection("docs")]);
    // Handle doc pages
    if (slug.startsWith("doc/")) {
      const docName = slug.substring(4);
      const doc = state.docs && state.docs.find((d) => d.slug === slug);
      const path = doc ? doc.path : `content/pages/${slug}.md`;
      try {
        const raw = await loadMarkdown(path);
        const { frontmatter, body } = parseMarkdown(raw);
        const html = renderMd(body);
        document.getElementById("page-content").removeAttribute("data-layout");
        updatePageMeta({
          title: frontmatter.title || docName,
          description: frontmatter.summary || frontmatter.description || "",
          author: frontmatter.author || "",
        });

        // Breadcrumb: Documentation → current title
        const breadcrumbHtml = `<nav class="breadcrumbs">
          <a href="#/documentation">Documentation</a>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-current">${escapeHtml(frontmatter.title || docName)}</span>
        </nav>`;

        // Next / previous page navigation
        const np = frontmatter.next_page;
        const pp = frontmatter.previous_page;
        const nextPage = Array.isArray(np) && np.length ? np[0] : (typeof np === "object" && np ? np : null);
        const prevPage = Array.isArray(pp) && pp.length ? pp[0] : (typeof pp === "object" && pp ? pp : null);
        let docNavHtml = "";
        if (prevPage || nextPage) {
          docNavHtml = '<div class="post-nav">';
          if (prevPage && prevPage.link) {
            docNavHtml += `<a href="${escapeHtml(prevPage.link)}" class="post-nav-link prev">
              <span class="post-nav-label">\u2190 Previous</span>
              <span class="post-nav-title">${escapeHtml(prevPage.title || "Previous")}</span>
            </a>`;
          } else {
            docNavHtml += "<div></div>";
          }
          if (nextPage && nextPage.link) {
            docNavHtml += `<a href="${escapeHtml(nextPage.link)}" class="post-nav-link next">
              <span class="post-nav-label">Next \u2192</span>
              <span class="post-nav-title">${escapeHtml(nextPage.title || "Next")}</span>
            </a>`;
          }
          docNavHtml += "</div>";
        }

        showContent(
          `${breadcrumbHtml}<div class="article-body">${html}</div>${docNavHtml}${contentFooter(frontmatter.author)}`,
        );
        initArticleImages();
        initSortableTables();
        initContentLinks();
        scrollToAnchor();
      } catch {
        showContent('<div class="empty-state"><h3>Documentation page not found</h3></div>');
      }
      return;
    }
    
    // Handle regular pages
    const page = state.pages.find((p) => p.slug === slug);
    const path = page ? page.path : `content/pages/${slug}.md`;
    try {
      const raw = await loadMarkdown(path);
      const { frontmatter, body } = parseMarkdown(raw);
      const html = renderMd(body);
      document.getElementById("page-content").removeAttribute("data-layout");
      updatePageMeta({
        title: frontmatter.title || slug,
        description: frontmatter.summary || frontmatter.description || "",
        author: frontmatter.author || "",
      });
      
      // Add documentation section for About page
      let content = `<div class="article-body">${html}</div>`;
      if (slug === "about") {
        content += `<section class="docs-section">
          <h2>Documentation</h2>
          <p>Raksara supports a set of custom components — panels, containers, chips, and sortable tables — available directly in Markdown with simple syntax extensions.</p>
          <a href="#/documentation" class="docs-section-link">View component documentation &#x2192;</a>
        </section>`;
      }
      content += contentFooter(frontmatter.author);
      
      showContent(content);
      initArticleImages();
      initSortableTables();
      initContentLinks();
      scrollToAnchor();
    } catch {
      showContent('<div class="empty-state"><h3>Page not found</h3></div>');
    }
  }

  // ── Content Footer ──────────────────────────────────────

  // ── Giscus Comments ──────────────────────────────────────

  function shouldShowGiscus(frontmatter, pageType) {
    const cfg = state.config && state.config.comments;
    if (!cfg || !cfg.enabled) return false;
    if (frontmatter.comments_enabled === false) return false;
    if (frontmatter.comments_enabled === true) return true;
    const defaultPages = Array.isArray(cfg.pages) ? cfg.pages : ["blog", "portfolio"];
    return defaultPages.includes(pageType);
  }

  function getGiscusTheme(theme) {
    return theme === "light" ? "light" : "dark_dimmed";
  }

  function syncGiscusTheme(theme) {
    const iframe = document.querySelector(".giscus-frame");
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme: getGiscusTheme(theme),
          },
        },
      },
      "https://giscus.app",
    );
  }

  function initGiscus(term) {
    const cfg = state.config && state.config.comments;
    if (!cfg || !cfg.enabled) return;
    const sentinel = document.getElementById("giscus-sentinel");
    if (!sentinel) return;
    let loaded = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loaded) {
          loaded = true;
          observer.disconnect();
          const script = document.createElement("script");
          script.src = "https://giscus.app/client.js";
          script.setAttribute("data-repo", cfg.repo);
          script.setAttribute("data-repo-id", cfg.repo_id);
          script.setAttribute("data-category", cfg.category);
          script.setAttribute("data-category-id", cfg.category_id);
          script.setAttribute("data-mapping", "specific");
          script.setAttribute("data-term", term);
          script.setAttribute("data-strict", cfg.strict ? "1" : "0");
          script.setAttribute("data-reactions-enabled", cfg.reactions_enabled ? "1" : "0");
          script.setAttribute("data-emit-metadata", cfg.emit_metadata ? "1" : "0");
          script.setAttribute("data-input-position", cfg.input_position || "top");
          script.setAttribute(
            "data-theme",
            getGiscusTheme(
              document.documentElement.getAttribute("data-theme") || "dark",
            ),
          );
          script.setAttribute("data-lang", cfg.lang || "en");
          script.setAttribute("data-loading", "lazy");
          script.crossOrigin = "anonymous";
          script.async = true;
          sentinel.appendChild(script);
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
  }

  function contentFooter(frontmatterAuthor) {
    const author =
      frontmatterAuthor || (state.config && state.config.author) || "";
    if (!author) return "";
    const year = new Date().getFullYear();
    return `<div class="content-footer">&copy; ${year} ${escapeHtml(author)}</div>`;
  }

  // __PAGES_REGION_B_END__

  // ── Share ───────────────────────────────────────────────

  function shareButton(title) {
    return `<button class="share-btn" aria-label="Share">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Share</span>
    </button>`;
  }

  function loadImageCors(url) {
    if (_imgCache[url]) return Promise.resolve(_imgCache[url]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timeout = setTimeout(() => {
        img.src = "";
        reject();
      }, 2000);
      img.onload = () => {
        clearTimeout(timeout);
        _imgCache[url] = img;
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject();
      };
      img.src = url;
    });
  }

  function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (maxLines && lines.length >= maxLines - 1) {
          lines.push(line + "\u2026");
          line = "";
          break;
        }
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (let i = 0; i < lines.length; i++)
      ctx.fillText(lines[i], x, y + i * lineHeight);
    return lines.length;
  }

  function canvasRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function createLogoImage(color) {
    return new Promise((resolve, reject) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -10 124 120" fill="${color}" stroke="${color}"><path d="M50 8 L8 50 L50 92 L92 50" stroke-width="10" stroke-linejoin="miter" stroke-linecap="butt" fill="none"/><path d="M 50 8 L 68 26" stroke-width="10" stroke-linecap="butt" fill="none"/><rect x="52" y="45" width="40" height="10" stroke="none"/><path d="M 35 22 C 22 8, 6 -2, -8 -4 C -4 4, 10 18, 26 32 Z" stroke="none"/><path d="M 26 68 C 10 84, -4 96, -8 104 C 4 96, 18 82, 35 78 Z" stroke="none"/></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  }

  function canvasFolderIcon(ctx, x, y, size, color) {
    const w = size,
      h = size * 0.78;
    const tabW = w * 0.38,
      tabH = h * 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + tabW, y - h);
    ctx.lineTo(x + tabW + tabH, y - h + tabH);
    ctx.lineTo(x + w, y - h + tabH);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  function canvasSeparator(ctx, x1, x2, y) {
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  async function generateShareImage(title, opts) {
    const {
      coverUrl,
      author,
      readTime,
      summary,
      isDirectory,
      pageCount,
      pageLabel,
      category,
      tags,
      dirPostTitles,
      isProfile,
      avatarUrl,
      role,
      socials,
      isGallery,
      galleryImageUrls,
      galleryCount,
      isThoughts,
      isPortfolioDetail,
    } = opts || {};
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const S = 1080;
    canvas.width = S;
    canvas.height = S;
    const cs = getComputedStyle(document.documentElement);
    const accent1 = cs.getPropertyValue("--gradient-1").trim() || "#6366f1";
    const accent2 = cs.getPropertyValue("--gradient-2").trim() || "#8b5cf6";

    let coverImg = null,
      logoImg = null,
      avatarImg = null;
    const galleryImgs = [];
    const loads = [
      createLogoImage(accent1)
        .then((i) => {
          logoImg = i;
        })
        .catch(() => {}),
    ];
    if (coverUrl)
      loads.push(
        loadImageCors(coverUrl)
          .then((i) => {
            coverImg = i;
          })
          .catch(() => {}),
      );
    if (isProfile && avatarUrl)
      loads.push(
        loadImageCors(avatarUrl)
          .then((i) => {
            avatarImg = i;
          })
          .catch(() => {}),
      );
    if (isGallery && galleryImageUrls) {
      galleryImageUrls.slice(0, 4).forEach((url, idx) => {
        loads.push(
          loadImageCors(url)
            .then((img) => {
              galleryImgs[idx] = img;
            })
            .catch(() => {}),
        );
      });
    }
    loads.push(
      Promise.race([
        document.fonts.load('700 52px "Inter"'),
        new Promise((r) => setTimeout(r, 500)),
      ]),
    );
    await Promise.all(loads);

    if (coverImg) {
      const thumbS = 128;
      const tc = document.createElement("canvas");
      tc.width = thumbS;
      tc.height = thumbS;
      const tctx = tc.getContext("2d");
      const ts = Math.max(thumbS / coverImg.width, thumbS / coverImg.height);
      tctx.filter = "blur(4px) brightness(0.32)";
      tctx.drawImage(
        coverImg,
        (thumbS - coverImg.width * ts) / 2,
        (thumbS - coverImg.height * ts) / 2,
        coverImg.width * ts,
        coverImg.height * ts,
      );
      tctx.filter = "none";
      ctx.drawImage(tc, 0, 0, S, S);
    } else {
      const bg = ctx.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, "#0f0f1a");
      bg.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 0.18;
      const o1 = ctx.createRadialGradient(
        S * 0.25,
        S * 0.2,
        0,
        S * 0.25,
        S * 0.2,
        S * 0.4,
      );
      o1.addColorStop(0, accent1);
      o1.addColorStop(1, "transparent");
      ctx.fillStyle = o1;
      ctx.fillRect(0, 0, S, S);
      const o2 = ctx.createRadialGradient(
        S * 0.82,
        S * 0.75,
        0,
        S * 0.82,
        S * 0.75,
        S * 0.35,
      );
      o2.addColorStop(0, accent1);
      o2.addColorStop(1, "transparent");
      ctx.fillStyle = o2;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 1;
    }

    const mg = 56,
      cardW = S - mg * 2,
      cardH = S - mg * 2,
      cardR = 18;
    const barW = 5,
      pad = 44;
    const footerH = 130,
      footerTop = mg + cardH - footerH;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 8;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.stroke();

    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    ctx.fillStyle = accent1;
    ctx.fillRect(mg, mg, barW, cardH);
    ctx.restore();

    const useWhiteFooter =
      !isProfile && !isThoughts && !isGallery && !isDirectory;
    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    if (useWhiteFooter) {
      ctx.fillStyle = "#f2f2f5";
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else if (coverImg) {
      const fs = Math.max(
        cardW / coverImg.width,
        (footerH * 2) / coverImg.height,
      );
      ctx.filter = "blur(4px) brightness(0.35)";
      ctx.drawImage(
        coverImg,
        mg + (cardW - coverImg.width * fs) / 2,
        footerTop + (footerH - coverImg.height * fs) / 2,
        coverImg.width * fs,
        coverImg.height * fs,
      );
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else {
      const fg = ctx.createLinearGradient(
        mg,
        footerTop,
        mg + cardW,
        footerTop + footerH,
      );
      fg.addColorStop(0, "#1a1a2e");
      fg.addColorStop(1, "#12122a");
      ctx.fillStyle = fg;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 0.2;
      const fo = ctx.createRadialGradient(
        mg + cardW * 0.3,
        footerTop + footerH / 2,
        0,
        mg + cardW * 0.3,
        footerTop + footerH / 2,
        250,
      );
      fo.addColorStop(0, accent1);
      fo.addColorStop(1, "transparent");
      ctx.fillStyle = fo;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = useWhiteFooter
      ? "rgba(0,0,0,0.10)"
      : "rgba(255,255,255,0.5)";
    ctx.lineWidth = useWhiteFooter ? 1 : 2.5;
    ctx.beginPath();
    ctx.moveTo(mg + barW, footerTop);
    ctx.lineTo(mg + cardW, footerTop);
    ctx.stroke();
    ctx.restore();

    const cx = mg + barW + pad,
      cr = mg + cardW - pad;
    const ct = mg + pad,
      cw = cr - cx;
    const centerX = (cx + cr) / 2;
    const fcx = mg + barW + pad,
      fcr = mg + cardW - pad;
    const fcy = footerTop + footerH / 2;
    const siteName = (state.config && state.config.hero_title) || "Raksara";

    if (isProfile) {
      const coverH = cardH - footerH + mg;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      if (coverImg) {
        const cvs = Math.max(cardW / coverImg.width, coverH / coverImg.height);
        ctx.filter = "blur(4px) brightness(0.4)";
        ctx.drawImage(
          coverImg,
          mg + (cardW - coverImg.width * cvs) / 2,
          mg + (coverH - coverImg.height * cvs) / 2,
          coverImg.width * cvs,
          coverImg.height * cvs,
        );
        ctx.filter = "none";
      } else {
        const cvg = ctx.createLinearGradient(mg, mg, mg + cardW, mg + coverH);
        cvg.addColorStop(0, "#1a1a2e");
        cvg.addColorStop(1, "#12122a");
        ctx.fillStyle = cvg;
        ctx.fillRect(mg, mg, cardW, coverH);
      }
      ctx.restore();

      const panelTop = mg + 260;
      const panelH = footerTop - panelTop;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = -4;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.stroke();
      ctx.restore();

      const aSize = 200;
      const aCy = panelTop - 10;
      if (avatarImg) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2, 0, Math.PI * 2);
        ctx.clip();
        const aS = Math.max(aSize / avatarImg.width, aSize / avatarImg.height);
        ctx.drawImage(
          avatarImg,
          centerX - (avatarImg.width * aS) / 2,
          aCy - (avatarImg.height * aS) / 2,
          avatarImg.width * aS,
          avatarImg.height * aS,
        );
        ctx.restore();
      }

      const nameY = aCy + aSize / 2 + 48;
      ctx.textAlign = "center";
      ctx.font = '700 42px "Inter", system-ui, sans-serif';
      const nameM = ctx.measureText(title || "");
      const nhPad = 18,
        nvPad = 10;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      canvasRoundRect(
        ctx,
        centerX - nameM.width / 2 - nhPad,
        nameY - 34 - nvPad,
        nameM.width + nhPad * 2,
        44 + nvPad * 2,
        10,
      );
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(title || "", centerX, nameY);

      let curProfileY = nameY;

      if (role) {
        curProfileY += 44;
        ctx.font = "500 20px Inter, -apple-system, sans-serif";
        const roleM = ctx.measureText(role);
        const rhPad = 14,
          rvPad = 7;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        canvasRoundRect(
          ctx,
          centerX - roleM.width / 2 - rhPad,
          curProfileY - 16 - rvPad,
          roleM.width + rhPad * 2,
          24 + rvPad * 2,
          8,
        );
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillText(role, centerX, curProfileY);
      }

      curProfileY += 38;
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 60, curProfileY);
      ctx.lineTo(cr - 60, curProfileY);
      ctx.stroke();

      const metadata = opts.metadata;
      if (metadata && metadata.length) {
        curProfileY += 24;
        ctx.textAlign = "left";
        const chipX = cx + 20;
        const chipMaxW = cw - 40;
        const cPadH = 20,
          cPadV = 11,
          cH = 22 + cPadV * 2,
          cR = cH / 2;
        for (const item of metadata.slice(0, 3)) {
          ctx.font = "700 17px Inter, -apple-system, sans-serif";
          const lblW = ctx.measureText(item.label).width;
          let fullW = lblW;
          let sepW = 0,
            valText = item.value || "";
          if (valText) {
            ctx.font = "400 17px Inter, -apple-system, sans-serif";
            sepW = ctx.measureText("  :  ").width;
            ctx.font = "500 17px Inter, -apple-system, sans-serif";
            fullW = lblW + sepW + ctx.measureText(valText).width;
            const maxInner = chipMaxW - cPadH * 2;
            if (fullW > maxInner) {
              const valMaxW = maxInner - lblW - sepW;
              while (
                ctx.measureText(valText).width > valMaxW &&
                valText.length > 1
              )
                valText = valText.slice(0, -1);
              if (valText.length < item.value.length) valText += "\u2026";
            }
            fullW = lblW + sepW + ctx.measureText(valText).width;
          }
          const chipW = Math.min(fullW + cPadH * 2, chipMaxW);

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.12)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = "rgba(40,40,50,0.75)";
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.stroke();

          const tY = curProfileY + cH / 2 + 6;
          ctx.font = "700 17px Inter, -apple-system, sans-serif";
          ctx.fillStyle = "#fff";
          ctx.fillText(item.label, chipX + cPadH, tY);
          if (item.value) {
            const lW = ctx.measureText(item.label).width;
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.font = "400 17px Inter, -apple-system, sans-serif";
            ctx.fillText("  :  ", chipX + cPadH + lW, tY);
            const sW = ctx.measureText("  :  ").width;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "500 17px Inter, -apple-system, sans-serif";
            ctx.fillText(valText, chipX + cPadH + lW + sW, tY);
          }
          curProfileY += cH + 10;
        }
      }
      ctx.textAlign = "left";

      if (logoImg) {
        const lh = 28,
          lw = lh * (logoImg.width / logoImg.height);
        ctx.font = "600 20px Inter, -apple-system, sans-serif";
        const snw = ctx.measureText(siteName).width;
        const totalW = lw + 10 + snw;
        const lx = centerX - totalW / 2;
        ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(siteName, lx + lw + 10, fcy + 8);
      }
    } else {
      const hasCover = !!coverImg;
      const maxCoverH = Math.floor(cardH * 0.25);
      const coverH = hasCover ? maxCoverH : 0;
      if (hasCover) {
        ctx.save();
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(mg, mg, cardW, coverH);
        ctx.clip();
        const cvs = Math.max(cardW / coverImg.width, coverH / coverImg.height);
        ctx.filter = "blur(2px)";
        ctx.drawImage(
          coverImg,
          mg + (cardW - coverImg.width * cvs) / 2,
          mg + (coverH - coverImg.height * cvs) / 2,
          coverImg.width * cvs,
          coverImg.height * cvs,
        );
        ctx.filter = "none";
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(mg, mg, cardW, coverH);
        ctx.restore();
      }

      const contentTop = mg + coverH + pad;
      let curY = contentTop;

      ctx.fillStyle = "#111";
      ctx.font = '700 54px "Inter", system-ui, sans-serif';
      const rawTitleLines = [];
      {
        const words = (title || "").split(" ");
        let line = "";
        for (const word of words) {
          const test = line + (line ? " " : "") + word;
          if (ctx.measureText(test).width > cw - 20 && line) {
            if (rawTitleLines.length >= 2) {
              rawTitleLines.push(line + "\u2026");
              line = "";
              break;
            }
            rawTitleLines.push(line);
            line = word;
          } else line = test;
        }
        if (line)
          rawTitleLines.push(
            rawTitleLines.length >= 3 ? line.slice(0, -1) + "\u2026" : line,
          );
      }
      const tLh = 68;
      if (hasCover) {
        for (let i = 0; i < rawTitleLines.length; i++) {
          const tw = ctx.measureText(rawTitleLines[i]).width;
          const hlPad = 10;
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          canvasRoundRect(
            ctx,
            cx - hlPad,
            curY - 4 + i * tLh,
            tw + hlPad * 2,
            tLh - 4,
            6,
          );
          ctx.fill();
        }
      }
      ctx.fillStyle = "#111";
      ctx.font = '700 54px "Inter", system-ui, sans-serif';
      for (let i = 0; i < rawTitleLines.length; i++)
        ctx.fillText(rawTitleLines[i], cx, curY + 48 + i * tLh);
      curY += rawTitleLines.length * tLh + 12;

      const hasSummary = !!summary;
      const hasChips = !!(category || (tags && tags.length));

      if (hasSummary) {
        canvasSeparator(ctx, cx, cr, curY);
        curY += 18;
        ctx.fillStyle = "#444";
        ctx.font = "400 22px Inter, -apple-system, sans-serif";
        const sumLines = canvasWrapText(ctx, summary, cx, curY, cw, 32, 4);
        curY += sumLines * 32 + 10;
      }

      if (hasChips) {
        const chipLabels = [];
        if (category) chipLabels.push(category);
        if (tags && tags.length) {
          for (const t of tags) {
            if (t !== category && chipLabels.length < 4) chipLabels.push(t);
          }
        }
        curY += 8;
        let chipX = cx;
        ctx.font = "600 15px Inter, -apple-system, sans-serif";
        for (const label of chipLabels) {
          const tw = ctx.measureText(label).width;
          const cW = tw + 24,
            cH = 32,
            cR = 7;
          if (chipX + cW > cr) break;
          ctx.fillStyle = "#f0f0f4";
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.06)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.stroke();
          ctx.fillStyle = accent1;
          ctx.fillText(label, chipX + 12, curY + 22);
          chipX += cW + 8;
        }
        curY += 40;
      }

      if (readTime && !isPortfolioDetail) {
        ctx.fillStyle = "#aaa";
        ctx.font = "500 15px Inter, -apple-system, sans-serif";
        ctx.fillText(readTime + " min read", cx, curY + 12);
        curY += 28;
      }

      const isDetailPage = !isDirectory && !isGallery && !isThoughts;
      if (isDetailPage && author) {
        const aPadH = 16,
          aPadV = 10,
          aFh = 18;
        ctx.font = "600 " + aFh + "px Inter, -apple-system, sans-serif";
        const aText = "by  " + author;
        const aTw = ctx.measureText(aText).width;
        const aW = aTw + aPadH * 2,
          aH = aFh + aPadV * 2,
          aR = aH / 2;
        const aX = fcx,
          aY = fcy - aH / 2;
        ctx.fillStyle = "rgba(40,40,50,0.82)";
        canvasRoundRect(ctx, aX, aY, aW, aH, aR);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(aText, aX + aPadH, aY + aPadV + aFh - 3);
      }

      if (isDetailPage && logoImg) {
        const lh = 22,
          lw = lh * (logoImg.width / logoImg.height);
        ctx.font = "600 16px Inter, -apple-system, sans-serif";
        const snw = ctx.measureText(siteName).width;
        const chipW = lw + 10 + snw + 28,
          chipH = 38,
          chipR = chipH / 2;
        const chipX = fcr - chipW,
          chipY = fcy - chipH / 2;
        ctx.fillStyle = "rgba(40,40,50,0.82)";
        canvasRoundRect(ctx, chipX, chipY, chipW, chipH, chipR);
        ctx.fill();
        ctx.drawImage(logoImg, chipX + 14, chipY + (chipH - lh) / 2, lw, lh);
        ctx.fillStyle = "#fff";
        ctx.fillText(siteName, chipX + 14 + lw + 8, fcy + 6);
      }

      if (isPortfolioDetail) {
        const availH = footerTop - curY - 10;
        const aSize = Math.min(availH, 260);
        const aCx = centerX,
          aCy = curY + availH / 2;
        const abbrev = (title || "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 6;
        const abGrad = ctx.createLinearGradient(
          aCx - aSize / 2,
          aCy - aSize / 2,
          aCx + aSize / 2,
          aCy + aSize / 2,
        );
        abGrad.addColorStop(0, accent1);
        abGrad.addColorStop(1, accent2);
        ctx.fillStyle = abGrad;
        canvasRoundRect(
          ctx,
          aCx - aSize / 2,
          aCy - aSize / 2,
          aSize,
          aSize,
          36,
        );
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.font =
          "bold " +
          Math.round(aSize * 0.45) +
          "px Inter, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(abbrev || "P", aCx, aCy + Math.round(aSize * 0.16));
        ctx.textAlign = "left";
      } else if (isThoughts) {
        const availH = footerTop - curY - 40;
        const bCx = centerX,
          bCy = curY + 16 + availH * 0.4;
        const bW = 380,
          bH = 260,
          bR = 32;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.10)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 2;
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.stroke();
        const dotY = bCy + bH / 2 + 24;
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        ctx.beginPath();
        ctx.arc(bCx - 24, dotY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bCx - 58, dotY + 30, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.07)";
        for (let i = 0; i < 4; i++) {
          const lw = bW * (0.75 - i * 0.12);
          canvasRoundRect(
            ctx,
            bCx - lw / 2,
            bCy - bH / 2 + 48 + i * 36,
            lw,
            14,
            7,
          );
          ctx.fill();
        }
        ctx.textAlign = "center";
        ctx.fillStyle = "#777";
        ctx.font = "500 24px Inter, -apple-system, sans-serif";
        ctx.fillText(
          "Random ideas that pop in my mind",
          bCx,
          bCy + bH / 2 + 80,
        );
        ctx.textAlign = "left";
        if (logoImg) {
          const lh = 28,
            lw = lh * (logoImg.width / logoImg.height);
          ctx.font = "600 20px Inter, -apple-system, sans-serif";
          const snw = ctx.measureText(siteName).width;
          const totalW = lw + 10 + snw;
          const lx = centerX - totalW / 2;
          ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(siteName, lx + lw + 10, fcy + 8);
        }
      } else if (isGallery) {
        const imgs = galleryImgs.filter(Boolean);
        const gridCount = Math.min(imgs.length, 4);
        if (gridCount) {
          const mGap = 14,
            mR = 10;
          const gridAvailH = footerTop - curY - 10;
          const mH = Math.floor((gridAvailH - mGap) / 2);
          const mW = mH;
          const gridTotalW = mW * 2 + mGap;
          const gridStartX = cx + (cw - gridTotalW) / 2;
          const mStartY = curY + 10;
          ctx.save();
          ctx.beginPath();
          ctx.rect(mg, mg, cardW, footerTop - mg);
          canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
          ctx.clip();
          for (let i = 0; i < 4; i++) {
            const col = i % 2,
              row = Math.floor(i / 2);
            const mx = gridStartX + col * (mW + mGap);
            const my = mStartY + row * (mH + mGap);
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.10)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1;
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.stroke();
            if (i < gridCount) {
              ctx.save();
              canvasRoundRect(ctx, mx, my, mW, mH, mR);
              ctx.clip();
              const img = imgs[i];
              const iScale = Math.max(mW / img.width, mH / img.height);
              ctx.drawImage(
                img,
                mx + (mW - img.width * iScale) / 2,
                my + (mH - img.height * iScale) / 2,
                img.width * iScale,
                img.height * iScale,
              );
              ctx.restore();
            }
          }
          ctx.restore();
        }
        const gCount = galleryCount || 0;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 28px Inter, -apple-system, sans-serif";
        ctx.fillText(
          gCount + " photo" + (gCount !== 1 ? "s" : ""),
          fcx,
          fcy + 11,
        );
      } else if (isDirectory) {
        canvasSeparator(ctx, cx, cr, curY + 8);
        const titles = dirPostTitles || [];
        const mGap = 14,
          mR = 10;
        const gridAvailH = footerTop - curY - 24;
        const mH = Math.floor((gridAvailH - mGap) / 2);
        const mW = mH;
        const gridTotalW = mW * 2 + mGap;
        const gridStartX = cx + (cw - gridTotalW) / 2;
        const mStartY = curY + 24;
        ctx.save();
        ctx.beginPath();
        ctx.rect(mg, mg, cardW, footerTop - mg);
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        for (let i = 0; i < 4; i++) {
          const col = i % 2,
            row = Math.floor(i / 2);
          const mx = gridStartX + col * (mW + mGap);
          const my = mStartY + row * (mH + mGap);
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.08)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.stroke();
          if (i < titles.length) {
            ctx.save();
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.clip();
            ctx.fillStyle = accent1;
            ctx.fillRect(mx, my, mW, 5);
            ctx.restore();
            ctx.fillStyle = "#333";
            ctx.font = "bold 18px Inter, -apple-system, sans-serif";
            canvasWrapText(
              ctx,
              titles[i] || "",
              mx + 14,
              my + 30,
              mW - 28,
              24,
              2,
            );
            ctx.fillStyle = "rgba(0,0,0,0.07)";
            for (let l = 0; l < 3; l++) {
              canvasRoundRect(
                ctx,
                mx + 14,
                my + 82 + l * 18,
                mW * (0.65 - l * 0.1),
                8,
                4,
              );
              ctx.fill();
            }
          }
        }
        ctx.restore();
        const label = pageLabel || "post";
        canvasFolderIcon(ctx, fcx, fcy + 14, 38, "rgba(255,255,255,0.9)");
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Inter, -apple-system, sans-serif";
        ctx.fillText(
          pageCount + " " + label + (pageCount !== 1 ? "s" : ""),
          fcx + 52,
          fcy + 11,
        );
      }
    }

    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  const _imgCache = {};
  function prefetchImage(url) {
    if (!url || _imgCache[url]) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      _imgCache[url] = img;
    };
    img.src = url;
  }

  function initShareButton(title, opts) {
    const btn = document.querySelector(".share-btn");
    if (!btn) return;
    if (opts && opts.coverUrl) prefetchImage(opts.coverUrl);
    if (opts && opts.avatarUrl) prefetchImage(opts.avatarUrl);
    btn.addEventListener("click", async () => {
      const url = window.location.href;
      const label = btn.querySelector("span");
      const origText = label ? label.textContent : "";
      if (label) label.textContent = "Generating...";
      try {
        if (navigator.share) {
          const shareData = { title, text: title, url };
          try {
            const testFile = new File([""], "t.png", { type: "image/png" });
            if (
              navigator.canShare &&
              navigator.canShare({ files: [testFile] })
            ) {
              const resolvedAuthor =
                (opts && opts.author) ||
                (state.config && state.config.author) ||
                "";
              const blob = await generateShareImage(title, {
                ...opts,
                author: resolvedAuthor,
              });
              if (blob)
                shareData.files = [
                  new File([blob], "share.png", { type: "image/png" }),
                ];
            }
          } catch {}
          if (label) label.textContent = origText;
          try {
            await navigator.share(shareData);
          } catch {}
          return;
        }
        try {
          const resolvedAuthor =
            (opts && opts.author) ||
            (state.config && state.config.author) ||
            "";
          const blob = await generateShareImage(title, {
            ...opts,
            author: resolvedAuthor,
          });
          const items = [
            new ClipboardItem({
              "text/plain": new Blob([title ? `${title} : ${url}` : url], {
                type: "text/plain",
              }),
              ...(blob ? { "image/png": blob } : {}),
            }),
          ];
          await navigator.clipboard.write(items);
          if (label) label.textContent = "Copied!";
          setTimeout(() => {
            if (label) label.textContent = origText;
          }, 2000);
        } catch {
          try {
            await navigator.clipboard.writeText(
              title ? `${title} : ${url}` : url,
            );
            if (label) label.textContent = "Copied!";
            setTimeout(() => {
              if (label) label.textContent = origText;
            }, 2000);
          } catch {}
        }
      } finally {
        if (label && label.textContent === "Generating...")
          label.textContent = origText;
      }
    });
  }

  // ── Image Lightbox in Articles ────────────────────────

  async function loadMermaidIfNeeded() {
    const mermaidBlocks = document.querySelectorAll(
      ".language-mermaid, .mermaid",
    );

    if (mermaidBlocks.length === 0) {
      return;
    }

    // Dynamically load mermaid only when needed
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    
    script.onload = () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
      });

      mermaidBlocks.forEach((block) => {
        let container;

        if (block.classList.contains("language-mermaid")) {
          // markdown code block
          container = document.createElement("div");
          container.className = "mermaid";
          container.textContent = block.textContent;

          block.parentElement.replaceWith(container);
        }
      });

      mermaid.run();
    };

    document.head.appendChild(script);
  }

  function initCodeBlocks() {
    document.querySelectorAll(".article-body pre").forEach((pre) => {
      if (pre.parentElement.classList.contains("code-block-wrap")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrap";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      const code = pre.querySelector("code");
      const codeText = code ? code.textContent || "" : pre.textContent || "";
      const lineCount = codeText ? codeText.split(/\r?\n/).length : 0;
      const isLong = lineCount > 18 || codeText.length > 1100;
      if (isLong) {
        wrapper.classList.add("is-collapsed");
        const fade = document.createElement("div");
        fade.className = "code-fade";
        wrapper.appendChild(fade);

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "code-toggle-btn";
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Expand code";
        toggle.addEventListener("click", () => {
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
          wrapper.classList.toggle("is-collapsed", expanded);
          toggle.textContent = expanded ? "Expand code" : "Collapse code";
        });
        wrapper.appendChild(toggle);
      }
      const btn = document.createElement("button");
      btn.className = "code-copy-btn";
      btn.title = "Copy code";
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.classList.add("copied");
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
          }, 2000);
        });
      });
      wrapper.appendChild(btn);
    });
  }

  function initVideoPlayers() {
    document.querySelectorAll(".article-body a.video-player").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const img = a.querySelector("img");
      const title = img ? img.alt || "" : a.getAttribute("data-title") || "";
      const src = img ? img.src : "";
      const thumbSrc = src || a.getAttribute("data-thumbnail") || "";
      if (!thumbSrc) return;
      const player = document.createElement("div");
      player.className = "video-player";
      player.addEventListener("click", () => window.open(href, "_blank"));
      player.innerHTML = `
        <img ${buildDetailImageAttrs(thumbSrc, {
          alt: title,
          loading: "lazy",
        })}>
        <div class="video-player-overlay">
          <div class="video-player-play">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          ${title ? `<div class="video-player-title">${escapeHtml(title)}</div>` : ""}
        </div>`;
      a.replaceWith(player);
    });
  }

  async function initArticleImages() {
    const codeNodes = Array.from(document.querySelectorAll(".article-body pre code"));
    if (codeNodes.length) {
      const langs = new Set();
      for (const el of codeNodes) {
        const cls = Array.from(el.classList).find((c) => c.startsWith("language-"));
        const lang = cls ? cls.slice("language-".length) : "plaintext";
        langs.add(normalizeHighlightLanguage(lang));
      }

      try {
        await ensureHighlightCoreLoaded();
        await Promise.all(Array.from(langs).map((l) => ensureHighlightLanguageLoaded(l)));
        if (highlightState.instance) {
          codeNodes.forEach((el) => highlightState.instance.highlightElement(el));
        }
      } catch {
        // ensureHighlightCoreLoaded already tries local then CDN; if both fail, leave code plain.
      }
    }

    initCodeBlocks();
    loadMermaidIfNeeded();
    initVideoPlayers();
    document.querySelectorAll(".article-body img").forEach((img) => {
      if (img.closest(".video-player")) return;
      img.addEventListener("click", () => openLightbox(img.src, img.alt));
    });
    initLazyImages();
    initFileAttachments();
  }

  let _carouselImages = [];
  let _carouselIndex = 0;
  let _carouselTransitionToken = 0;

  function preloadCarouselImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        try {
          if (typeof img.decode === "function") await img.decode();
        } catch {
          // Ignore decode errors and continue with loaded bitmap.
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function openLightbox(src, caption) {
    _carouselImages = [];
    _carouselIndex = 0;
    _carouselTransitionToken += 1;
    const lb = document.getElementById("lightbox");
    const content = lb.querySelector(".lightbox-content");
    content
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-caption").textContent = caption || "";
    lb.classList.remove("hidden");
  }

  function openCarousel(images, startIndex) {
    _carouselImages = images;
    _carouselIndex = startIndex || 0;
    _carouselTransitionToken += 1;
    const lb = document.getElementById("lightbox");
    const content = lb.querySelector(".lightbox-content");
    content
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
    const current = images[_carouselIndex];
    document.getElementById("lightbox-img").src = resolvePath(current.src);
    document.getElementById("lightbox-caption").textContent =
      current.caption || "";

    // Preload adjacent slides for smoother next/prev transitions.
    if (images.length > 1) {
      const prev = images[(_carouselIndex - 1 + images.length) % images.length];
      const next = images[(_carouselIndex + 1) % images.length];
      if (prev && prev.src) preloadCarouselImage(resolvePath(prev.src));
      if (next && next.src) preloadCarouselImage(resolvePath(next.src));
    }
    if (images.length > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.className = "lightbox-nav prev";
      prevBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      prevBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateCarousel(-1);
      });
      const nextBtn = document.createElement("button");
      nextBtn.className = "lightbox-nav next";
      nextBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      nextBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateCarousel(1);
      });
      content.appendChild(prevBtn);
      content.appendChild(nextBtn);
      const dots = document.createElement("div");
      dots.className = "lightbox-dots";
      images.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.className =
          "lightbox-dot" + (i === _carouselIndex ? " active" : "");
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          goToCarouselSlide(i);
        });
        dots.appendChild(dot);
      });
      content.appendChild(dots);
    }
    lb.classList.remove("hidden");
  }

  function navigateCarousel(dir) {
    if (_carouselImages.length < 2) return;
    _carouselIndex =
      (_carouselIndex + dir + _carouselImages.length) % _carouselImages.length;
    updateCarouselSlide();
  }

  function goToCarouselSlide(index) {
    _carouselIndex = index;
    updateCarouselSlide();
  }

  async function updateCarouselSlide() {
    const current = _carouselImages[_carouselIndex];
    if (!current) return;

    const img = document.getElementById("lightbox-img");
    const nextSrc = resolvePath(current.src);
    const token = ++_carouselTransitionToken;

    img.style.opacity = "0";
    await preloadCarouselImage(nextSrc);
    if (token !== _carouselTransitionToken) return;

    img.src = nextSrc;
    document.getElementById("lightbox-caption").textContent =
      current.caption || "";

    requestAnimationFrame(() => {
      if (token !== _carouselTransitionToken) return;
      img.style.opacity = "1";
    });

    // Keep near slides warm in cache during carousel navigation.
    if (_carouselImages.length > 1) {
      const prev = _carouselImages[
        (_carouselIndex - 1 + _carouselImages.length) % _carouselImages.length
      ];
      const next = _carouselImages[(_carouselIndex + 1) % _carouselImages.length];
      if (prev && prev.src) preloadCarouselImage(resolvePath(prev.src));
      if (next && next.src) preloadCarouselImage(resolvePath(next.src));
    }

    document.querySelectorAll(".lightbox-dot").forEach((dot, i) => {
      dot.classList.toggle("active", i === _carouselIndex);
    });
  }

  function closeLightbox() {
    const lb = document.getElementById("lightbox");
    lb.classList.add("hidden");
    document.getElementById("lightbox-img").src = "";
    _carouselImages = [];
    _carouselIndex = 0;
    _carouselTransitionToken += 1;
    lb.querySelector(".lightbox-content")
      .querySelectorAll(".lightbox-nav, .lightbox-dots")
      .forEach((el) => el.remove());
  }

  window.__openLightbox = openLightbox;

  window.__openGallery = function (galleryIndex) {
    const g = state.gallery[galleryIndex];
    if (!g) return;
    const images = getGalleryImages(g);
    if (!images.length) return;
    if (images.length === 1) {
      openLightbox(resolvePath(images[0].src), images[0].caption || g.caption);
    } else {
      openCarousel(images, 0);
    }
  };

  // ── Router ────────────────────────────────────────────

  async function handleRoute() {
    teardownPagination();
    if (_typingTimer) {
      clearTimeout(_typingTimer);
      _typingTimer = null;
    }
    document.body.classList.remove("reading-mode");
    document.body.style.overflow = "";

    // Skip loading spinner if page content was pre-rendered into HTML —
    // keep it visible to the user while data loads in the background.
    const pageContent = document.getElementById("page-content");
    const prerenderedTag = pageContent && pageContent.dataset.prerendered;
    const currentPath = getCurrentRoutePath();
    const currentParts = currentPath.split("/").filter(Boolean);
    const isPrerendered =
      (prerenderedTag === "home" && (currentPath === "/" || currentPath === "")) ||
      (prerenderedTag === "profile" && currentParts[0] === "profile");
    if (!isPrerendered) {
      showLoading();
    }

    await loadData();
    if (!state.loaded) return;

    const route = getCurrentRoutePath();
    const parts = route.split("/").filter(Boolean);
    updateActiveNav(route);

    const needsMarkdown =
      (parts[0] === "blog" && parts[1] === "post" && parts.length > 2) ||
      (parts[0] === "portfolio" && !!parts[1]) ||
      parts[0] === "profile" ||
      parts[0] === "about" ||
      parts[0] === "doc" ||
      (parts.length === 1 &&
        parts[0] &&
        ![
          "blog",
          "portfolio",
          "gallery",
          "thoughts",
          "tags",
          "tag",
          "categories",
          "category",
          "profile",
          "about",
          "doc",
        ].includes(parts[0]));
    if (needsMarkdown) {
      await ensureMarkdownVendorLoaded();
    }

    if (route === "/" || route === "") await renderHome();
    else if (parts[0] === "blog" && parts[1] === "post" && parts.length > 2)
      await renderBlogPost(parts.slice(2).join("/"));
    else if (parts[0] === "blog" && parts[1] === "dir" && parts.length > 2)
      await renderBlogDir(parts.slice(2).join("/"));
    else if (parts[0] === "blog") await renderBlogDir("");
    else if (parts[0] === "portfolio" && parts[1])
      await renderPortfolioItem(parts[1]);
    else if (parts[0] === "portfolio") await renderPortfolioList();
    else if (parts[0] === "gallery" && parts[1])
      await renderGallery(parseInt(parts[1]));
    else if (parts[0] === "gallery") await renderGallery();
    else if (parts[0] === "thoughts") await renderThoughts();
    else if (parts[0] === "tags") await renderTags();
    else if (parts[0] === "tag" && parts[1])
      await renderTagPosts(decodeURIComponent(parts[1]));
    else if (parts[0] === "categories") await renderCategories();
    else if (parts[0] === "category" && parts[1])
      await renderCategoryPosts(decodeURIComponent(parts[1]));
    else if (parts[0] === "profile") await renderProfile();
    else if (parts[0] === "about") await renderPage("about");
    else if (parts[0] === "doc" && parts[1])
      await renderPage(`doc/${parts[1]}`);
    else await renderPage(parts[0]);

    // Background-prefetch all remaining sections during idle time
    prefetchAllSections();

    // Defer AdSense script work until there is clear user intent or slot visibility.
    scheduleAdsenseBootstrap();
  }

  function updateActiveNav(route) {
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
      const lr = link.getAttribute("data-route");
      if (!lr) return;
      if (lr === "home" && (route === "/" || route === ""))
        link.classList.add("active");
      else if (lr !== "home" && route.startsWith("/" + lr))
        link.classList.add("active");
    });
  }

  // ── Search Overlay ────────────────────────────────────

  function initSearch() {
    const trigger = document.getElementById("search-trigger");
    const overlay = document.getElementById("search-overlay");
    const input = document.getElementById("search-overlay-input");
    const results = document.getElementById("search-overlay-results");
    const backdrop = overlay.querySelector(".search-overlay-backdrop");
    let debounceTimer;

    const searchPhrases = [
      "Search posts...",
      "Search projects...",
      "Search thoughts...",
      "Search tags...",
    ];
    let phraseIdx = 0,
      phraseCharIdx = 0,
      phraseDir = 1,
      phraseTimer = null;

    function animatePlaceholder() {
      if (overlay.classList.contains("hidden") || input.value.length > 0)
        return;
      const phrase = searchPhrases[phraseIdx];
      if (phraseDir === 1) {
        phraseCharIdx++;
        if (phraseCharIdx > phrase.length) {
          phraseDir = -1;
          phraseTimer = setTimeout(animatePlaceholder, 2000);
          return;
        }
      } else {
        phraseCharIdx--;
        if (phraseCharIdx < 0) {
          phraseDir = 1;
          phraseIdx = (phraseIdx + 1) % searchPhrases.length;
          phraseCharIdx = 0;
          phraseTimer = setTimeout(animatePlaceholder, 400);
          return;
        }
      }
      input.setAttribute("placeholder", phrase.slice(0, phraseCharIdx));
      phraseTimer = setTimeout(animatePlaceholder, phraseDir === 1 ? 80 : 40);
    }

    async function openSearch() {
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (!state.miniSearch) {
        input.setAttribute("placeholder", "Loading search index...");
        try {
          await ensureMiniSearchReady();
          if (!state.miniSearch) {
            input.setAttribute("placeholder", "Search unavailable right now");
          }
        } catch (err) {
          console.warn("Search initialization failed:", err);
          input.setAttribute("placeholder", "Search unavailable right now");
        } finally {
          if (state.miniSearch) {
            input.setAttribute("placeholder", "Search posts, projects, pages...");
          }
        }
      }
      setTimeout(() => input.focus(), 50);
      phraseIdx = 0;
      phraseCharIdx = 0;
      phraseDir = 1;
      if (phraseTimer) clearTimeout(phraseTimer);
      animatePlaceholder();
    }

    function closeSearch() {
      overlay.classList.add("hidden");
      document.body.style.overflow = "";
      input.value = "";
      input.setAttribute("placeholder", "Search posts, projects, pages...");
      results.innerHTML = "";
      if (phraseTimer) {
        clearTimeout(phraseTimer);
        phraseTimer = null;
      }
    }

    trigger.addEventListener("click", openSearch);
    backdrop.addEventListener("click", closeSearch);

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") closeSearch();
    });

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      if (!input.value && !overlay.classList.contains("hidden")) {
        if (phraseTimer) clearTimeout(phraseTimer);
        phraseCharIdx = 0;
        phraseDir = 1;
        animatePlaceholder();
      }
      debounceTimer = setTimeout(() => {
        const query = input.value.trim();
        if (query.length < 2 || !state.miniSearch) {
          results.innerHTML = "";
          return;
        }
        const hits = state.miniSearch.search(query, { limit: 10 });
        if (!hits.length) {
          results.innerHTML =
            '<div class="search-empty">No results found</div>';
          return;
        }
        results.innerHTML = hits
          .map((h) => {
            let href = "/";
            if (h.section === "blog") href = `/blog/post/${h.slug}`;
            else if (h.section === "portfolio") href = `/portfolio/${h.slug}`;
            else if (h.section === "gallery") href = "/gallery";
            else if (h.section === "thoughts") href = "/thoughts";
            else if (h.section === "pages") href = `/${h.slug}`;
            return `<div class="search-result-item" data-href="${href}">
            <div class="search-result-title">${escapeHtml(h.title)}</div>
            <div class="search-result-meta">${escapeHtml(h.section)}${h.category ? " \u00B7 " + escapeHtml(h.category) : ""}</div>
          </div>`;
          })
          .join("");
        results.querySelectorAll(".search-result-item").forEach((item) => {
          item.addEventListener("click", () => {
            navigateTo(item.dataset.href);
            closeSearch();
          });
        });
      }, 150);
    });
  }

  // ── Theme Toggle ──────────────────────────────────────

  const COLOR_PALETTES = {
    purple: {
      accent: "#6366f1",
      hoverDark: "#818cf8",
      hoverLight: "#4f46e5",
      g1: "#6366f1",
      g2: "#8b5cf6",
      g3: "#a855f7",
      rgb: "99,102,241",
    },
    blue: {
      accent: "#3b82f6",
      hoverDark: "#60a5fa",
      hoverLight: "#2563eb",
      g1: "#3b82f6",
      g2: "#06b6d4",
      g3: "#0ea5e9",
      rgb: "59,130,246",
    },
    red: {
      accent: "#ef4444",
      hoverDark: "#f87171",
      hoverLight: "#dc2626",
      g1: "#ef4444",
      g2: "#f43f5e",
      g3: "#ec4899",
      rgb: "239,68,68",
    },
    yellow: {
      accent: "#eab308",
      hoverDark: "#facc15",
      hoverLight: "#ca8a04",
      g1: "#eab308",
      g2: "#f59e0b",
      g3: "#f97316",
      rgb: "234,179,8",
    },
    green: {
      accent: "#22c55e",
      hoverDark: "#4ade80",
      hoverLight: "#16a34a",
      g1: "#22c55e",
      g2: "#10b981",
      g3: "#14b8a6",
      rgb: "34,197,94",
    },
    orange: {
      accent: "#f97316",
      hoverDark: "#fb923c",
      hoverLight: "#ea580c",
      g1: "#f97316",
      g2: "#fb923c",
      g3: "#fbbf24",
      rgb: "249,115,22",
    },
  };

  function applyAccentColor(colorName) {
    const c =
      COLOR_PALETTES[(colorName || "").toLowerCase()] || COLOR_PALETTES.purple;
    const s = document.documentElement.style;
    const isDark =
      document.documentElement.getAttribute("data-theme") !== "light";

    s.setProperty("--accent", c.accent);
    s.setProperty("--accent-hover", isDark ? c.hoverDark : c.hoverLight);
    s.setProperty("--accent-subtle", `rgba(${c.rgb},${isDark ? 0.12 : 0.08})`);
    s.setProperty("--accent-border", `rgba(${c.rgb},${isDark ? 0.3 : 0.2})`);
    s.setProperty("--accent-glow", `rgba(${c.rgb},${isDark ? 0.15 : 0.1})`);
    s.setProperty("--gradient-1", c.g1);
    s.setProperty("--gradient-2", c.g2);
    s.setProperty("--gradient-3", c.g3);
    s.setProperty("--gradient-4", c.g1);

    if (isDark) {
      s.setProperty("--bg-hover", "rgba(255,255,255,0.06)");
      s.setProperty("--bg-active", "rgba(255,255,255,0.08)");
    } else {
      s.setProperty("--bg-hover", `rgba(${c.rgb},0.06)`);
      s.setProperty("--bg-active", `rgba(${c.rgb},0.08)`);
    }

    s.setProperty(
      "--gradient-bg",
      `radial-gradient(ellipse 80% 60% at 20% 0%, rgba(${c.rgb},${isDark ? 0.12 : 0.08}) 0%, transparent 50%),` +
        `radial-gradient(ellipse 60% 50% at 80% 100%, rgba(${c.rgb},${isDark ? 0.08 : 0.06}) 0%, transparent 50%),` +
        `radial-gradient(ellipse 50% 40% at 50% 50%, rgba(${c.rgb},${isDark ? 0.05 : 0.03}) 0%, transparent 50%)`,
    );
  }

  async function applyLogo(logoPath) {
    try {
      const res = await fetch(logoPath);
      if (!res.ok) return;
      const svgText = await res.text();
      const tmp = document.createElement("div");
      tmp.innerHTML = svgText.trim();
      const svg = tmp.querySelector("svg");
      if (!svg) return;
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.style.display = "block";
      document.querySelectorAll(".logo-icon").forEach((el) => {
        el.textContent = "";
        el.appendChild(svg.cloneNode(true));
      });
      const faviconSvg = svg.cloneNode(true);
      faviconSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const blob = new Blob([faviconSvg.outerHTML], { type: "image/svg+xml" });
      const faviconUrl = URL.createObjectURL(blob);
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/svg+xml";
      link.href = faviconUrl;
    } catch {
      /* logo not available, keep fallback */
    }
  }

  function syncThemeIcons(theme) {
    const containers = [
      document.getElementById("theme-toggle"),
      document.querySelector(".mobile-theme-toggle"),
    ];
    for (const c of containers) {
      if (!c) continue;
      const sun = c.querySelector(".icon-sun");
      const moon = c.querySelector(".icon-moon");
      if (sun) sun.style.display = theme === "light" ? "block" : "none";
      if (moon) moon.style.display = theme === "dark" ? "block" : "none";
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("raksara-theme", theme);
    syncThemeIcons(theme);
    applyAccentColor(getConfiguredAccentColor(state.config));
    syncGiscusTheme(theme);
    const hljsDark = document.getElementById("hljs-dark");
    const hljsLight = document.getElementById("hljs-light");
    if (hljsDark) hljsDark.disabled = theme === "light";
    if (hljsLight) hljsLight.disabled = theme === "dark";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initTheme() {
    if (state.config && state.config.logo) {
      const _logo = "content/" + state.config.logo;
      (window.requestIdleCallback
        ? (fn) => window.requestIdleCallback(fn, { timeout: 3000 })
        : (fn) => setTimeout(fn, 200))(() => applyLogo(_logo));
    }
    if (state.config && state.config.hero_title) applyLogoText(state.config.hero_title);
    const saved = localStorage.getItem("raksara-theme");
    const theme =
      saved || document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(theme);
    document
      .getElementById("theme-toggle")
      .addEventListener("click", toggleTheme);
  }

  // ── Lightbox Events ───────────────────────────────────

  function initLightbox() {
    const lb = document.getElementById("lightbox");
    lb.querySelector(".lightbox-backdrop").addEventListener(
      "click",
      closeLightbox,
    );
    lb.querySelector(".lightbox-close").addEventListener(
      "click",
      closeLightbox,
    );
    document.addEventListener("keydown", (e) => {
      if (lb.classList.contains("hidden")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft" && _carouselImages.length > 1)
        navigateCarousel(-1);
      if (e.key === "ArrowRight" && _carouselImages.length > 1)
        navigateCarousel(1);
    });
  }

  // ── Mobile Sidebar ────────────────────────────────────

  function initMobileSidebar() {
    let header = document.querySelector(".mobile-header");

    if (!header) {
      // Fallback: dynamically create header (should not happen with pre-rendered HTML)
      const siteName = (state.config && state.config.hero_title) || "Raksara";
      const logoIcon = state.config && state.config.logo
        ? `<img src="${escapeHtml(resolvePath("content/" + state.config.logo))}" alt="${escapeHtml(siteName)}" width="18" height="18">`
        : "\u25C6";
      header = document.createElement("div");
      header.className = "mobile-header";
      header.innerHTML = `
        <button class="mobile-menu-btn" aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <a href="./" class="logo"><span class="logo-icon">${logoIcon}</span><span class="logo-text">${escapeHtml(siteName)}</span></a>
        <button class="icon-btn mobile-theme-toggle" aria-label="Toggle theme">
          <svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          <svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;
      document.body.prepend(header);
    }

    // Attach event listeners (only once, guarded by a flag)
    if (!header._sidebarBound) {
      header._sidebarBound = true;

      const sidebar = document.getElementById("sidebar");

      header
        .querySelector(".mobile-theme-toggle")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          toggleTheme();
        });

      header.querySelector(".mobile-menu-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
      });

      document
        .getElementById("content")
        .addEventListener("click", () => sidebar.classList.remove("open"));

      sidebar.querySelectorAll("a, button:not(#theme-toggle)").forEach((el) => {
        el.addEventListener("click", () => sidebar.classList.remove("open"));
      });
    }

    syncThemeIcons(
      document.documentElement.getAttribute("data-theme") || "dark",
    );

    // Enable sidebar transitions after initial paint (prevents animation on first load)
    requestAnimationFrame(() => {
      document.body.classList.add("sidebar-ready");
    });
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    initBasePath();
    initClientRouting();
    if (window.location.hash && window.location.hash.startsWith("#/")) {
      navigateTo(window.location.hash, { replace: true });
    }
    initTheme();
    initMobileSidebar();
    handleRoute();
    // Search overlay and lightbox are event-listener-only setups.
    // Wire them during idle time so they don't lengthen the critical init task.
    (window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
      : (fn) => setTimeout(fn, 100))(() => {
      initSearch();
      initLightbox();
    });
  }

  // Stable contract consumed by lazily loaded route chunk.
  window.__RAKSARA_CORE__ = {
    state,
    runtime,
    SEO_INITIAL_COUNT,
    getPaginationState: () => _paginationState,
    showContent,
    showLoading,
    loadMarkdown,
    parseMarkdown,
    renderMd,
    ensureSection,
    ensureImageManifest,
    ensureMarkdownVendorLoaded,
    ensureRoutesBundleLoaded,
    buildResponsiveImageAttrs,
    buildDetailImageAttrs,
    getImageManifestEntry,
    getGalleryImages,
    updatePageMeta,
    navigateTo,
    shareButton,
    initShareButton,
    renderStatusChip,
    initArticleImages,
    initSortableTables,
    initParallax,
    initLazyImages,
    escapeHtml,
    formatDate,
    resolvePath,
    toPublicAssetHref,
    humanize,
    getAbsolutePageUrl,
    resolveContentLink,
    normalizeLegacyRouteLinks,
    blogBreadcrumbs,
    getSortedItems,
    initPagination,
    computeItemsPerPage,
    setupPaginationSentinel,
    dirControlsHtml,
    initDirControls,
    loadJSON,
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
