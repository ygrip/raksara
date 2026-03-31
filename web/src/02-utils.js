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

