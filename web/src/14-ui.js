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
