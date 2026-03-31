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

    // When prerendered we only need frontmatter for metadata/share — skip pages
    // section fetch and use the default path to avoid a network round-trip.
    let filePath = "content/pages/profile.md";
    if (!isPrerendered) {
      await ensureSection("pages");
      const page = state.pages.find((p) => p.slug === "profile");
      filePath = page ? page.path : filePath;
    }
    try {
      const raw = await loadMarkdown(filePath);
      const { frontmatter, body } = parseMarkdown(raw);

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

      if (isPrerendered) {
        // Content already in DOM — clear flag and reset any transition styles.
        // renderMd() is intentionally skipped: the prerendered body HTML is
        // already in the DOM and vendor-markdown.min.js is not loaded yet,
        // so calling it here would block the main thread for no gain.
        delete el.dataset.prerendered;
        el.style.opacity = "";
        el.style.transform = "";
        el.style.transition = "";
      } else {
        const html = renderMd(body);

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

