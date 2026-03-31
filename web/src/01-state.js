  const POSTS_PER_PAGE = 10;
  const SEO_INITIAL_COUNT = 12;

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