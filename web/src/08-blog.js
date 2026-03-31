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

