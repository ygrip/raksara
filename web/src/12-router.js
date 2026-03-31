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
      (parts[0] === "profile" && !isPrerendered) ||
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