  // ── File Attachments ──────────────────────────────────

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function getFileCategory(ext) {
    const e = (ext || "").toLowerCase();
    if (["pdf"].includes(e)) return "pdf";
    if (["doc", "docx", "odt", "rtf"].includes(e)) return "doc";
    if (["xls", "xlsx", "ods", "csv"].includes(e)) return "xls";
    if (["ppt", "pptx", "odp"].includes(e)) return "ppt";
    if (["zip", "rar", "gz", "tar", "7z", "bz2"].includes(e)) return "zip";
    if (
      ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "avif"].includes(e)
    )
      return "img";
    if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(e)) return "video";
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(e)) return "audio";
    if (
      [
        "js", "ts", "jsx", "tsx", "py", "java", "go", "rs", "c", "cpp",
        "cs", "php", "rb", "sh", "bash", "html", "css", "json", "yml",
        "yaml", "toml", "xml", "sql",
      ].includes(e)
    )
      return "code";
    if (["md", "txt", "log", "tex"].includes(e)) return "text";
    return "file";
  }

  function getFileTypeLabel(ext) {
    const e = (ext || "").toLowerCase();
    const labels = {
      pdf: "PDF", doc: "DOC", docx: "DOC", odt: "ODT", rtf: "RTF",
      xls: "XLS", xlsx: "XLS", ods: "ODS", csv: "CSV",
      ppt: "PPT", pptx: "PPT", odp: "ODP",
      zip: "ZIP", rar: "RAR", gz: "GZ", tar: "TAR", "7z": "7Z", bz2: "BZ2",
      jpg: "JPG", jpeg: "JPG", png: "PNG", gif: "GIF", svg: "SVG",
      webp: "WEBP", bmp: "BMP", avif: "AVIF",
      mp4: "MP4", mov: "MOV", avi: "AVI", mkv: "MKV", webm: "WEBM",
      mp3: "MP3", wav: "WAV", ogg: "OGG", flac: "FLAC", aac: "AAC", m4a: "M4A",
      md: "MD", txt: "TXT", log: "LOG", tex: "TEX",
      js: "JS", ts: "TS", jsx: "JSX", tsx: "TSX", py: "PY", java: "JAVA",
      go: "GO", rs: "RS", c: "C", cpp: "CPP", cs: "C#", php: "PHP",
      rb: "RB", sh: "SH", bash: "SH", html: "HTML", css: "CSS",
      json: "JSON", yml: "YAML", yaml: "YAML", toml: "TOML", xml: "XML", sql: "SQL",
    };
    return labels[e] || e.toUpperCase().slice(0, 5) || "FILE";
  }

  function renderFileAttachmentHtml(filePath, displayName) {
    const resolved = toPublicAssetHref(filePath);
    const filename = displayName || filePath.split("/").pop();
    const dotIdx = filename.lastIndexOf(".");
    const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
    const category = getFileCategory(ext);
    const label = getFileTypeLabel(ext);
    const fontSize = label.length > 3 ? "7" : "9";
    const iconSvg = `<svg width="44" height="52" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.75" y="0.75" width="42.5" height="50.5" rx="5.25" fill="var(--bg-card)" stroke="var(--border-color)" stroke-width="1.5"/><path d="M27 1 L43 17 L27 17 Z" fill="var(--file-fold-color)" opacity="0.45"/><path d="M27 1 L27 17 L43 17" stroke="var(--border-color)" stroke-width="1.5" fill="none" stroke-linejoin="round"/><text x="22" y="37" text-anchor="middle" fill="var(--file-label-color)" font-weight="700" font-size="${fontSize}" font-family="system-ui,sans-serif" letter-spacing="0.8">${escapeHtml(label)}</text></svg>`;
    return `<div class="file-attachment-block"><a class="file-attachment" href="${escapeHtml(resolved)}" download data-ext="${escapeHtml(ext)}" data-category="${escapeHtml(category)}"><div class="file-attachment-icon">${iconSvg}</div><div class="file-attachment-info"><span class="file-attachment-name">${escapeHtml(filename)}</span><span class="file-attachment-meta"><span class="file-attachment-badge">${escapeHtml(label || ext || "FILE")}</span><span class="file-attachment-size" data-size-url="${escapeHtml(resolved)}"></span></span></div><div class="file-attachment-dl"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5l3.5 4 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div></a></div>`;
  }

  function preprocessFileAttachments(md) {
    return md.replace(/::file\[([^\]\n]+)\]/g, (_match, inner) => {
      const nameMatch = inner.match(/^(.*?)\s+"([^"]+)"$/);
      const filePath = (nameMatch ? nameMatch[1] : inner).trim();
      const displayName = nameMatch ? nameMatch[2] : null;
      if (!filePath) return _match;
      return renderFileAttachmentHtml(filePath, displayName);
    });
  }

  // ── Custom Element: PANEL ────────────────────────────────

  // Module-scope code-block vault — populated during renderMd so inject
  // functions (injectPanels, injectContainers) can restore inline/fenced
  // code that was hidden before preprocessors ran.
  const renderCodeBlocks = [];
  const restoreRenderCodeBlocks = (s) =>
    s.replace(/\x02RAKSARA_CB_(\d+)\x03/g, (_, i) => renderCodeBlocks[parseInt(i, 10)] || "");

  const panelStorage = [];

  function preprocessCustomPanels(md) {
    panelStorage.length = 0;
    return md.replace(/\<panel\s+type=["']?(info|note|warning|error|success)["']?\s*\>([\s\S]*?)\<\/panel\>/gi, (_match, type, inner) => {
      panelStorage.push({ type: type.toLowerCase(), content: inner.trim() });
      return `[[RAKSARA_PANEL:${panelStorage.length - 1}]]`;
    });
  }

  function injectPanels(html) {
    if (panelStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_PANEL:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= panelStorage.length) return match;
      const { type, content } = panelStorage[index];
      const panelContent = marked.parse(restoreRenderCodeBlocks(content));
      const icons = {
        info: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        note: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/><path d="M4 5h8M4 8.5h8M4 12h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
        error: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        success: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      };
      const icon = icons[type] || icons.info;
      return `<div class="panel panel-${type}" role="note"><span class="panel-icon">${icon}</span><div class="panel-body">${panelContent}</div></div>`;
    });
  }

  // ── Custom Element: CONTAINER ────────────────────────────────

  const containerStorage = [];

  function preprocessCustomContainers(md) {
    containerStorage.length = 0;
    return md.replace(/\<container\s*\>([\s\S]*?)\<\/container\>/gi, (_match, inner) => {
      containerStorage.push(inner.trim());
      return `[[RAKSARA_CONTAINER:${containerStorage.length - 1}]]`;
    });
  }

  function injectContainers(html) {
    if (containerStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_CONTAINER:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= containerStorage.length) return match;
      const content = marked.parse(restoreRenderCodeBlocks(containerStorage[index]));
      return `<div class="custom-container glass">${content}</div>`;
    });
  }

  // ── Custom Element: CHIP ────────────────────────────────

  const chipStorage = [];

  function preprocessCustomChips(md) {
    chipStorage.length = 0;
    return md.replace(/\<chip((?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*\>([\s\S]*?)\<\/chip\>/gi, (_match, attrsStr, inner) => {
      const attrs = parseChipAttributes(attrsStr);
      chipStorage.push({ attrs, content: inner.trim() });
      return `[[RAKSARA_CHIP:${chipStorage.length - 1}]]`;
    });
  }

  function parseChipAttributes(str) {
    const attrs = { icon: null, label: null };
    const matches = str.matchAll(/(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1];
      const value = m[2] || m[3] || m[4] || "";
      if (key === "icon") attrs.icon = value;
      if (key === "label") attrs.label = value;
    }
    return attrs;
  }

  function injectChips(html) {
    if (chipStorage.length === 0) return html;
    return html.replace(/\[\[RAKSARA_CHIP:(\d+)\]\]/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= chipStorage.length) return match;
      const { attrs, content } = chipStorage[index];
      const iconHtml = renderChipIcon(attrs.icon);
      const labelHtml = attrs.label ? `<span class="chip-label">${escapeHtml(attrs.label)}</span>` : "";
      return `<span class="chip glass">${iconHtml}${labelHtml}<span class="chip-text">${escapeHtml(content)}</span></span>`;
    });
  }

  function renderChipIcon(icon) {
    if (!icon) return "";
    const namedIcons = {
      check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 5.5v4M8 4v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L1.5 14h13L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      star: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5l2-5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
      tag: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2h6a1 1 0 011 1v5a1 1 0 01-1 1H8l-6 6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><circle cx="11" cy="5" r="1" fill="currentColor"/></svg>',
      link: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 9a3 3 0 103-3M10 7a3 3 0 11-1.5 2.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      user: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
      code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 3L1 8l3.5 5M11.5 3l3.5 5-3.5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'arrow-right': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      external: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-1.5M2 7v6a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    if (namedIcons[icon]) {
      return `<span class="chip-icon">${namedIcons[icon]}</span>`;
    }
    // Check if it's an emoji or single character
    if (icon.length > 0 && !/^https?:\/\/|^\//.test(icon)) {
      return `<span class="chip-icon-text">${escapeHtml(icon)}</span>`;
    }
    return "";
  }

  // ── ::component Card List ────────────────────────────

  const componentStorage = [];

  function preprocessCustomComponents(md) {
    componentStorage.length = 0;
    return md.replace(/::component\s*\(\s*([^)]+?)\s*\)/g, (match, pathArg) => {
      componentStorage.push(pathArg.trim());
      return `[[RAKSARA_COMPONENT:${componentStorage.length - 1}]]`;
    });
  }

  function injectCustomComponents(html) {
    if (componentStorage.length === 0) return html;
    return html.replace(/(?:<p>)?\[\[RAKSARA_COMPONENT:(\d+)\]\](?:<\/p>)?/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= componentStorage.length) return match;
      const pathArg = componentStorage[index];
      const prefix = "content/" + pathArg.replace(/^\/|\/$/g, "") + "/";
      const allEntries = [...(state.docs || []), ...(state.pages || [])];
      const matching = allEntries.filter(e => e.path && e.path.startsWith(prefix));
      if (matching.length === 0) return "";
      const listId = `cl-${Math.random().toString(36).substr(2, 8)}`;
      let out = `<div class="component-list-wrap">`;
      out += `<div class="component-list-search-wrap"><input class="component-list-search" type="search" placeholder="Filter components…" aria-label="Filter components" data-list="${listId}"></div>`;
      out += `<div class="component-list" id="${listId}">`;
      for (const entry of matching) {
        const title = escapeHtml(entry.title || "Untitled");
        const desc = escapeHtml(entry.summary || entry.description || "");
        const icon = entry.icon || "";
        const status = entry.status || "";
        const href = `#/${entry.slug}`;
        out += `<a href="${href}" class="component-card glass"`;
        out += ` data-title="${escapeHtml((entry.title || "").toLowerCase())}" data-desc="${escapeHtml((entry.summary || entry.description || "").toLowerCase())}"`;
        out += `>`;
        out += `<div class="component-card-header">`;
        if (icon) out += `<span class="component-card-icon">${escapeHtml(icon)}</span>`;
        out += `<span class="component-card-title">${title}</span>`;
        if (status) {
          const statusClass = "status-" + status.toLowerCase().replace(/\s+/g, "-");
          out += `<span class="component-card-status ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>`;
        }
        out += `</div>`;
        if (desc) out += `<p class="component-card-desc">${desc}</p>`;
        out += `<div class="component-card-footer">`;
        out += `<span class="component-card-link">See detail →</span>`;
        out += `</div>`;
        out += `</a>`;
      }
      out += '</div></div>';
      return out;
    });
  }

  // ── Table Sorting ────────────────────────────────────

  function initSortableTables() {
    const tables = document.querySelectorAll(".article-body table");
    tables.forEach((table) => {
      const thead = table.querySelector("thead");
      if (!thead) return;
      const headers = thead.querySelectorAll("th");
      headers.forEach((th, colIndex) => {
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.setAttribute("role", "button");
        th.setAttribute("aria-sort", "none");
        const sortIcon = document.createElement("span");
        sortIcon.className = "sort-icon";
        sortIcon.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="display: inline; margin-left: 4px;"><path d="M3 1l2 2 2-2M3 6l2-2 2 2" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/></svg>';
        th.appendChild(sortIcon);
        th.addEventListener("click", () => sortTable(table, colIndex, th, headers));
      });
    });
  }

  function sortTable(table, colIndex, th, headers) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const currentSort = th.getAttribute("aria-sort") || "none";
    let isAsc = currentSort === "none" || currentSort === "desc";
    if (currentSort === "none") {
      headers.forEach((h) => h.setAttribute("aria-sort", "none"));
      th.setAttribute("aria-sort", "ascending");
      isAsc = true;
    } else if (currentSort === "ascending") {
      th.setAttribute("aria-sort", "descending");
      isAsc = false;
    } else {
      th.setAttribute("aria-sort", "none");
      isAsc = null;
    }
    if (isAsc === null) {
      const firstRow = tbody.querySelector("tr");
      if (firstRow) {
        const origOrder = Array.from(firstRow.parentElement.querySelectorAll("tr"));
        origOrder.forEach((r) => tbody.appendChild(r));
      }
      return;
    }
    rows.sort((rowA, rowB) => {
      const cellA = rowA.querySelectorAll("td")[colIndex]?.textContent.trim() || "";
      const cellB = rowB.querySelectorAll("td")[colIndex]?.textContent.trim() || "";
      const numA = parseFloat(cellA);
      const numB = parseFloat(cellB);
      const isNumeric = !isNaN(numA) && !isNaN(numB) && cellA !== "" && cellB !== "";
      if (isNumeric) {
        return isAsc ? numA - numB : numB - numA;
      }
      return isAsc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });
    rows.forEach((r) => tbody.appendChild(r));
  }

  async function initFileAttachments() {
    const els = document.querySelectorAll(
      ".file-attachment-size[data-size-url]",
    );
    await Promise.all(
      Array.from(els).map(async (el) => {
        const url = el.dataset.sizeUrl;
        el.removeAttribute("data-size-url");
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            const cl = res.headers.get("content-length");
            el.textContent = cl ? formatFileSize(parseInt(cl, 10)) : "";
          }
        } catch {
          // size unavailable — leave empty
        }
      }),
    );
  }

  function getGalleryImages(g) {
    const raw = Array.isArray(g.images) && g.images.length > 0
      ? g.images
      : g.image
        ? [{ src: g.image, caption: g.caption || "" }]
        : [];

    const normalized = raw
      .map((img) => {
        if (!img) return null;
        if (typeof img === "string") {
          return { src: img, caption: g.caption || "" };
        }
        if (typeof img === "object") {
          return {
            src: img.src || "",
            caption: img.caption || g.caption || "",
          };
        }
        return null;
      })
      .filter((img) => img && img.src);

    // Deduplicate exact repeated sources to avoid duplicate carousel frames.
    const seen = new Set();
    return normalized.filter((img) => {
      const key = resolvePath(img.src);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getImageShell(img) {
    return img.closest(
      ".post-card-thumb, .gallery-item, .gallery-card-img, .gallery-stack-card, .article-cover, .poem-cover, .profile-avatar-wrap",
    );
  }

  async function settleImage(img) {
    try {
      if (typeof img.decode === "function") {
        await img.decode();
      }
    } catch {
      // Ignore decode failures and reveal the image anyway.
    }

    img.classList.add("loaded");
    const shell = getImageShell(img);
    if (shell) {
      shell.classList.remove("is-loading");
      shell.classList.add("is-loaded");
    }
  }

  function initLazyImages(root) {
    const imgs = Array.from(
      (root || document).querySelectorAll("img:not(.loaded)")
    );

    // Separate LCP candidate (first image in the list, loaded eagerly) from
    // the rest so we can batch all non-LCP LQIP style mutations into one RAF
    // instead of triggering N independent style invalidations.
    const lqipBatch = [];

    imgs.forEach((img, idx) => {
      const shell = getImageShell(img);
      if (shell && !shell.classList.contains("is-loaded")) {
        shell.classList.add("is-loading");
        const lqip = img.dataset.lqip;
        if (lqip) {
          if (idx === 0) {
            // LCP image: apply LQIP inline so the placeholder appears
            // on the very next frame without waiting for a batch.
            shell.style.setProperty("--lqip-url", `url("${lqip}")`);
            requestAnimationFrame(() => {
              if (!shell.classList.contains("is-loaded")) {
                shell.classList.add("lqip-shown");
              }
            });
          } else {
            // Non-LCP: queue for single batched RAF below.
            lqipBatch.push({ shell, lqip });
          }
        }
      }

      if (img.complete) {
        settleImage(img);
        return;
      }

      img.addEventListener("load", () => settleImage(img), { once: true });
      img.addEventListener("error", () => settleImage(img), { once: true });
    });

    // One RAF for all remaining LQIP injections — single style recalculation
    // instead of one per image, reducing layout thrashing on busy pages.
    if (lqipBatch.length) {
      requestAnimationFrame(() => {
        lqipBatch.forEach(({ shell, lqip }) => {
          shell.style.setProperty("--lqip-url", `url("${lqip}")`);
          if (!shell.classList.contains("is-loaded")) {
            shell.classList.add("lqip-shown");
          }
        });
      });
    }
  }