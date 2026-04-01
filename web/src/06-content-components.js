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
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      panelStorage.length = 0;
    }
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
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      containerStorage.length = 0;
    }
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
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      chipStorage.length = 0;
    }
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
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      componentStorage.length = 0;
    }
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

  // ── Custom Element: THOUGHT ───────────────────────────────

  const thoughtStorage = [];

  function preprocessCustomThoughts(md) {
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      thoughtStorage.length = 0;
    }
    return md.replace(/<thought((?:\s+\w+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/thought>/gi, (_match, attrsStr, inner) => {
      const attrs = parseThoughtAttrs(attrsStr);
      thoughtStorage.push({ attrs, content: inner.trim() });
      return `[[RAKSARA_THOUGHT:${thoughtStorage.length - 1}]]`;
    });
  }

  function parseThoughtAttrs(str) {
    const attrs = { author: "", logo: "", align: "right" };
    const matches = str.matchAll(/(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1].toLowerCase();
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ""));
      if (key === "author") attrs.author = value;
      if (key === "logo") attrs.logo = value;
      if (key === "align") attrs.align = value === "left" ? "left" : "right";
    }
    return attrs;
  }

  function injectThoughts(html) {
    if (thoughtStorage.length === 0) return html;
    return html.replace(/(?:<p>)?\[\[RAKSARA_THOUGHT:(\d+)\]\](?:<\/p>)?/g, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= thoughtStorage.length) return match;
      const { attrs, content } = thoughtStorage[index];
      const isLeft = attrs.align === "left";
      const bodyHtml = marked.parse(restoreRenderCodeBlocks(content));
      const logoHtml = attrs.logo
        ? `<img class="thought-bubble-logo" src="${escapeHtml(resolvePath(attrs.logo))}" alt="${escapeHtml(attrs.author)}" width="24" height="24">`
        : "";
      const authorHtml = attrs.author
        ? `<div class="thought-bubble-attribution">${logoHtml}<span class="thought-bubble-author">${escapeHtml(attrs.author)}</span></div>`
        : "";
      return `<div class="thought-bubble thought-bubble-${isLeft ? "left" : "right"}">
        <span class="thought-bubble-quote">\u201C</span>
        <div class="thought-bubble-body">${bodyHtml}</div>
        ${authorHtml}
      </div>`;
    });
  }

  // ── Custom Element: PROGRESS ──────────────────────────────

  const progressStorage = [];

  const _PROGRESS_ICONS = {
    fire: "🔥", star: "⭐", check: "✓", flag: "🚩", bolt: "⚡",
    heart: "❤️", trophy: "🏆", target: "🎯", pin: "📌", lock: "🔒",
    rocket: "🚀", gem: "💎", crown: "👑", shield: "🛡️", warning: "⚠️",
  };

  function preprocessCustomProgress(md) {
    // Only clear storage during top-level processing to avoid clearing during nested grid processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      progressStorage.length = 0;
    }
    const toToken = (attrsStr, inner = "") => {
      const attrs = parseProgressAttrs(attrsStr);
      const bars = [];
      const barRe = /<bar((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/bar>/gi;
      let bm;
      while ((bm = barRe.exec(inner)) !== null) {
        const ba = parseProgressAttrs(bm[1]);
        bars.push({ at: parseInt(ba.at, 10) || 0, icon: ba.icon || "", text: bm[2].trim() });
      }
      progressStorage.push({ attrs, bars });
      // Keep progress tokens block-level to avoid invalid <p><div> nesting
      // when authors place <rk-progress> directly after inline markdown text.
      return `\n\n[[RAKSARA_PROGRESS:${progressStorage.length - 1}]]\n\n`;
    };

    // Paired form: <rk-progress ...> ... </rk-progress>
    let out = md.replace(/<rk-progress((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/rk-progress>/gi, (_match, attrsStr, inner) => {
      return toToken(attrsStr, inner);
    });

    // Self-closing form: <rk-progress ... />
    out = out.replace(/<rk-progress((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*\/\s*>/gi, (_match, attrsStr) => {
      return toToken(attrsStr, "");
    });

    return out;
  }

  function parseProgressAttrs(str) {
    const attrs = {};
    const matches = str.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1].toLowerCase();
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : "true"));
      attrs[key] = value;
    }
    return attrs;
  }

  function injectProgress(html) {
    if (progressStorage.length === 0) return html;
    const replaceProgressToken = (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= progressStorage.length) return match;
      const { attrs, bars } = progressStorage[index];
      const total = Math.max(1, parseInt(attrs.total, 10) || 100);
      const current = Math.min(total, Math.max(0, parseInt(attrs.current, 10) || 0));
      const pct = (current / total) * 100;
      const color = attrs.color ? buildProgressColor(attrs.color) : "var(--accent)";
      const borderStyle = attrs.border ? ` border-color: ${escapeHtml(attrs.border)};` : "";
      let barsHtml = "";
      for (const bar of bars) {
        const barPct = Math.min(100, Math.max(0, (bar.at / total) * 100));
        const iconChar = _PROGRESS_ICONS[bar.icon] || (bar.icon ? escapeHtml(bar.icon) : "");
        const iconHtml = iconChar
          ? `<span class="rk-bar-icon">${iconChar}</span>`
          : `<span class="rk-bar-dot" style="background:${color}"></span>`;
        const tooltipHtml = bar.text ? `<div class="rk-bar-tooltip">${escapeHtml(bar.text)}</div>` : "";
        barsHtml += `<div class="rk-bar" style="left:${barPct.toFixed(2)}%">${iconHtml}${tooltipHtml}</div>`;
      }
      return `<div class="rk-progress-wrap">
        <div class="rk-progress" style="${borderStyle}" data-pct="${pct.toFixed(2)}">
          <div class="rk-progress-track">
            <div class="rk-progress-fill" style="--rk-prog-color:${color}; --rk-prog-target:${pct.toFixed(2)}%"></div>
            ${barsHtml}
          </div>
        </div>
        <div class="rk-progress-label"><span class="rk-progress-current">${current}</span><span class="rk-progress-sep">/</span><span class="rk-progress-total">${total}</span></div>
      </div>`;
    };

    // Replace full paragraph-wrapped tokens first, then bare tokens.
    // This avoids partial replacements that can leave broken paragraph HTML.
    const withParagraphTokens = html.replace(/<p>\s*\[\[RAKSARA_PROGRESS:(\d+)\]\]\s*<\/p>/g, replaceProgressToken);
    return withParagraphTokens.replace(/\[\[RAKSARA_PROGRESS:(\d+)\]\]/g, replaceProgressToken);
  }

  function buildProgressColor(name) {
    const map = {
      red: "#ef4444", purple: "var(--accent)", green: "#22c55e",
      blue: "#3b82f6", white: "#ffffff", yellow: "#eab308",
      orange: "#f97316",
    };
    return map[name.toLowerCase()] || escapeHtml(name);
  }

  function initProgressBars() {
    const fills = document.querySelectorAll(".rk-progress-fill:not([data-animated])");
    if (!fills.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const fill = entry.target;
        fill.dataset.animated = "1";
        observer.unobserve(fill);
        requestAnimationFrame(() => {
          fill.classList.add("rk-progress-animating");
        });
      });
    }, { threshold: 0.3 });
    fills.forEach((fill) => observer.observe(fill));
  }

  // ── Custom Element: GRID ──────────────────────────────────

  const gridStorage = [];

  function preprocessCustomGrid(md) {
    // Only clear storage during top-level processing to avoid clearing during nested processing
    if (typeof window._processingDepth === 'undefined' || window._processingDepth === 1) {
      gridStorage.length = 0;
    }
    return md.replace(/<grid((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/grid>/gi, (_match, attrsStr, inner) => {
      const attrs = parseProgressAttrs(attrsStr); // reuse generic attr parser
      const col = Math.min(4, Math.max(2, parseInt(attrs.column || attrs.col || attrs.cols, 10) || 3));
      gridStorage.push({ col, content: inner.trim() });
      // Force grid placeholders to block-level so injection is stable in markdown paragraphs.
      return `\n\n[[RAKSARA_GRID:${gridStorage.length - 1}]]\n\n`;
    });
  }

  function injectGrid(html) {
    if (gridStorage.length === 0) return html;
    const replaceGridToken = (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index < 0 || index >= gridStorage.length) return match;
      const { col, content } = gridStorage[index];
      const rawInner = marked.parse(restoreRenderCodeBlocks(content));
      // Run all injectors on the inner HTML so nested components render correctly.
      // Preprocessors (progress, thoughts, chips, etc.) already ran on the full text,
      // replacing tags with [[RAKSARA_*:N]] tokens — those tokens land inside
      // gridStorage.content and would be lost unless we inject them here too.
      const inner = injectProgress(injectThoughts(injectCustomComponents(injectChips(injectContainers(injectPanels(rawInner))))));
      return `<div class="rk-grid rk-grid-cols-${col}">${inner}</div>`;
    };

    const withParagraphTokens = html.replace(/<p>\s*\[\[RAKSARA_GRID:(\d+)\]\]\s*<\/p>/g, replaceGridToken);
    return withParagraphTokens.replace(/\[\[RAKSARA_GRID:(\d+)\]\]/g, replaceGridToken);
  }

  // ── Custom Element: CHART ─────────────────────────────────

  // chartStorage is populated by renderer.code in 04-markdown.js when lang === "chart"
  const chartStorage = [];
  
  // Global chart registry for theme updates
  const chartInstances = new Map();

  function _isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function _deepMerge(base, override) {
    if (!_isPlainObject(base)) return _isPlainObject(override) ? { ...override } : override;
    const out = { ...base };
    if (!_isPlainObject(override)) return out;
    for (const key of Object.keys(override)) {
      const a = out[key];
      const b = override[key];
      out[key] = _isPlainObject(a) && _isPlainObject(b) ? _deepMerge(a, b) : b;
    }
    return out;
  }

  function _readCssVar(styles, name, fallback) {
    const v = styles.getPropertyValue(name).trim();
    return v || fallback;
  }

  function _getChartThemeDefaults() {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const theme = root.getAttribute("data-theme") || "dark";
    const isDark = theme !== "light";

    const textPrimary = _readCssVar(styles, "--text-primary", isDark ? "#f0f0f5" : "#1a1a2e");
    const textSecondary = _readCssVar(styles, "--text-secondary", isDark ? "#9898aa" : "#555566");
    const borderColor = _readCssVar(styles, "--border-color", isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.14)");
    const bgCard = _readCssVar(styles, "--bg-card", isDark ? "rgba(20,20,32,0.55)" : "rgba(255,255,255,0.6)");

    const gridColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(31,41,55,0.22)";
    const angleLineColor = isDark ? "rgba(255,255,255,0.16)" : "rgba(31,41,55,0.2)";
    const tooltipBg = isDark ? "rgba(10,10,18,0.92)" : "rgba(255,255,255,0.97)";
    const lineFill = isDark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.14)";

    return {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 900, easing: "easeInOutQuart" },
      color: textSecondary,
      layout: { padding: 4 },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: textSecondary,
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
          },
        },
        title: {
          color: textPrimary,
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textPrimary,
          bodyColor: textSecondary,
          borderColor,
          borderWidth: 1,
        },
      },
      scales: {
        r: {
          angleLines: { color: angleLineColor, lineWidth: 1 },
          grid: { color: gridColor, lineWidth: 1 },
          pointLabels: { color: textSecondary },
          ticks: {
            color: textSecondary,
            showLabelBackdrop: false,
          },
        },
      },
      elements: {
        point: {
          radius: 3,
          hoverRadius: 5,
        },
        arc: {
          borderWidth: 2,
          borderColor: bgCard,
        },
      },
    };
  }

  async function initCharts() {
    // Find containers with either data-chart-idx or data-chart-config
    const containers = document.querySelectorAll(".rk-chart-container[data-chart-idx], .rk-chart-container[data-chart-config]:not([data-chart-idx])");
    if (!containers.length) return;
    try {
      await ensureChartVendorLoaded();
    } catch {
      containers.forEach((el) => { el.style.display = "none"; });
      return;
    }
    await Promise.all(Array.from(containers).map(async (el) => {
      const idx = parseInt(el.dataset.chartIdx, 10);
      let raw = chartStorage[idx];
      // Always try to fall back to embedded config if storage is cleared
      if (raw === undefined) {
        const encoded = el.getAttribute("data-chart-config") || "";
        if (encoded) {
          try {
            raw = decodeURIComponent(encoded);
          } catch {
            raw = undefined;
          }
        }
      }
      if (raw === undefined) { el.style.display = "none"; return; }
      let config;
      try {
        // Author-written content is trusted; this is equivalent to any template engine eval.
        // eslint-disable-next-line no-new-func
        config = new Function('"use strict"; return (' + raw + ");")();
      } catch {
        el.style.display = "none";
        return;
      }
      // If data field is a string path → fetch the JSON file
      if (config && typeof config.data === "string") {
        const dataPath = config.data;
        try {
          const url = /^https?:\/\//.test(dataPath) ? dataPath : resolvePath(dataPath);
          const res = await fetch(url);
          if (!res.ok) throw new Error("fetch failed");
          config.data = await res.json();
        } catch {
          el.style.display = "none";
          return;
        }
      }
      if (!config || !config.type || !config.data) { el.style.display = "none"; return; }
      try {
        el.removeAttribute("data-chart-idx");
        el.innerHTML = '<div class="rk-chart-zoom-controls"><button class="rk-chart-zoom-btn" data-zoom-out aria-label="Zoom out">−</button><span class="rk-chart-zoom-level">100%</span><button class="rk-chart-zoom-btn" data-zoom-in aria-label="Zoom in">+</button><button class="rk-chart-zoom-btn" data-zoom-reset aria-label="Reset zoom">Reset</button></div><div class="rk-chart-viewport"><div class="rk-chart-inner"><canvas></canvas></div></div>';
        const canvas = el.querySelector("canvas");
        const baseOptions = _getChartThemeDefaults();
        const isLineLike = config.type === "line" || config.type === "radar";
        if (isLineLike) {
          baseOptions.elements = _deepMerge(baseOptions.elements || {}, {
            line: {
              borderWidth: 2,
              tension: 0,
            },
          });
        }
        
        // Ensure legend is always visible
        baseOptions.plugins = _deepMerge(baseOptions.plugins || {}, {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              boxWidth: 12,
              font: {
                size: 12,
              },
            },
          },
        });
        
        // Make chart fill the container perfectly
        baseOptions.responsive = true;
        baseOptions.maintainAspectRatio = false;
        baseOptions.layout = _deepMerge(baseOptions.layout || {}, {
          padding: 0,
        });
        
        const merged = {
          ...config,
          options: _deepMerge(baseOptions, config.options || {}),
        };
        const chartInstance = new window.Chart(canvas, merged);
        
        // Register chart instance for theme updates and zoom tracking
        const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        chartInstances.set(chartId, { instance: chartInstance, originalConfig: config, zoomLevel: 100 });
        el.dataset.chartId = chartId;
        
        // Initialize zoom controls with scroll capability
        initChartZoom(el, chartId);
      } catch {
        el.style.display = "none";
      }
    }));
  }
  
  function initChartZoom(container, chartId) {
    const viewport = container.querySelector(".rk-chart-viewport");
    const inner = container.querySelector(".rk-chart-inner");
    const levelDisplay = container.querySelector(".rk-chart-zoom-level");
    const zoomInBtn = container.querySelector("[data-zoom-in]");
    const zoomOutBtn = container.querySelector("[data-zoom-out]");
    const zoomResetBtn = container.querySelector("[data-zoom-reset]");
    
    if (!viewport || !inner || !levelDisplay || !zoomInBtn || !zoomOutBtn || !zoomResetBtn) return;
    
    const chartData = chartInstances.get(chartId);
    if (!chartData) return;
    
    let currentZoom = 100;
    const minZoom = 100;
    const maxZoom = 300;  // 3x zoom
    const zoomStep = 10;
    
    function updateZoomLevel() {
      levelDisplay.textContent = `${currentZoom}%`;
      inner.style.transform = `scale(${currentZoom / 100})`;
      chartData.zoomLevel = currentZoom;
      zoomOutBtn.disabled = currentZoom <= minZoom;
      zoomInBtn.disabled = currentZoom >= maxZoom;
    }
    
    zoomInBtn.addEventListener("click", () => {
      if (currentZoom < maxZoom) {
        currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
        updateZoomLevel();
      }
    });
    
    zoomOutBtn.addEventListener("click", () => {
      if (currentZoom > minZoom) {
        currentZoom = Math.max(currentZoom - zoomStep, minZoom);
        updateZoomLevel();
      }
    });
    
    zoomResetBtn.addEventListener("click", () => {
      currentZoom = 100;
      updateZoomLevel();
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
    
    updateZoomLevel();
  }
  
  // Reset zoom levels for all charts when route changes (before teardown)
  function resetChartZooms() {
    chartInstances.forEach(({ instance }, chartId) => {
      const chartEl = document.querySelector(`[data-chart-id="${chartId}"]`);
      if (chartEl) {
        const viewport = chartEl.querySelector(".rk-chart-viewport");
        const inner = chartEl.querySelector(".rk-chart-inner");
        const levelDisplay = chartEl.querySelector(".rk-chart-zoom-level");
        if (viewport && inner && levelDisplay) {
          inner.style.transform = "scale(1)";
          levelDisplay.textContent = "100%";
          viewport.scrollLeft = 0;
          viewport.scrollTop = 0;
          const chartData = chartInstances.get(chartId);
          if (chartData) chartData.zoomLevel = 100;
          // Re-enable buttons
          const btns = chartEl.querySelectorAll(".rk-chart-zoom-btn");
          btns.forEach(btn => btn.disabled = false);
          const zoomOutBtn = chartEl.querySelector("[data-zoom-out]");
          if (zoomOutBtn) zoomOutBtn.disabled = true;
        }
      }
    });
  }
  
  // Update all chart themes when theme changes
  window.updateChartThemes = function updateChartThemes() {
    if (!window.Chart || chartInstances.size === 0) return;
    
    const newThemeDefaults = _getChartThemeDefaults();
    
    chartInstances.forEach(({ instance, originalConfig }, chartId) => {
      try {
        const isLineLike = originalConfig.type === "line" || originalConfig.type === "radar";
        let baseOptions = { ...newThemeDefaults };
        
        if (isLineLike) {
          baseOptions.elements = _deepMerge(baseOptions.elements || {}, {
            line: {
              borderWidth: 2,
              tension: 0,
            },
          });
        }
        
        const newOptions = _deepMerge(baseOptions, originalConfig.options || {});
        
        // Update chart options
        Object.assign(instance.options, newOptions);
        
        // Force chart update
        instance.update('none'); // 'none' = no animation for smooth theme transitions
      } catch (error) {
        console.warn(`Failed to update chart theme for ${chartId}:`, error);
        // Remove broken chart from registry
        chartInstances.delete(chartId);
      }
    });
  }