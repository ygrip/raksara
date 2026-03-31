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

  async function ensureChartVendorLoaded() {
    if (typeof window.Chart !== "undefined") return;
    await loadScriptOnce(toAssetHref("vendor-chart.min.js"), "chartPromise");
    if (typeof window.Chart === "undefined") {
      throw new Error("Chart vendor loaded but Chart is unavailable");
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

