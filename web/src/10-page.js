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