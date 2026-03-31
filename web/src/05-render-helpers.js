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