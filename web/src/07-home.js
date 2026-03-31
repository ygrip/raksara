  
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