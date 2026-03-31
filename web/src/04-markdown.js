  function parseMarkdown(text) {
    const gm = text.match(/^---\n([\s\S]*?)\n---/);
    let frontmatter = {};
    let body = text;
    if (gm) {
      body = text.slice(gm[0].length);
      const lines = gm[1].split("\n");
      let currentKey = null;
      let arrayMode = false;
      let objBuffer = null;
      for (const line of lines) {
        const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (kv) {
          if (objBuffer && currentKey) {
            frontmatter[currentKey].push(objBuffer);
            objBuffer = null;
          }
          currentKey = kv[1];
          const val = kv[2].trim().replace(/^["']|["']$/g, "");
          if (val === "") {
            frontmatter[currentKey] = [];
            arrayMode = true;
          } else {
            frontmatter[currentKey] = val;
            arrayMode = false;
          }
        } else if (!objBuffer && arrayMode && currentKey && line.match(/^\s+\w[\w-]*:/) && !line.match(/^\s*-\s/)) {
          // Plain YAML object: `key:\n  subkey: val` (no dash prefix, not inside an array item)
          // Convert from empty array to plain object on first indented property seen.
          // Guard: only fires when objBuffer is null — if we're building an array item object,
          // its sub-keys must be handled by the objBuffer branch below.
          if (Array.isArray(frontmatter[currentKey]) && frontmatter[currentKey].length === 0) {
            frontmatter[currentKey] = {};
          }
          if (typeof frontmatter[currentKey] === "object" && !Array.isArray(frontmatter[currentKey])) {
            const nestedKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
            if (nestedKv)
              frontmatter[currentKey][nestedKv[1]] = nestedKv[2].trim().replace(/^["']|["']$/g, "");
          }
        } else if (arrayMode && currentKey && line.match(/^\s*-\s+\w[\w-]*:/)) {
          if (objBuffer) frontmatter[currentKey].push(objBuffer);
          const objKv = line.match(/^\s*-\s+(\w[\w-]*):\s*(.*)$/);
          objBuffer = {};
          if (objKv)
            objBuffer[objKv[1]] = objKv[2].trim().replace(/^["']|["']$/g, "");
        } else if (objBuffer && line.match(/^\s+\w[\w-]*:/)) {
          const nestedKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
          if (nestedKv)
            objBuffer[nestedKv[1]] = nestedKv[2]
              .trim()
              .replace(/^["']|["']$/g, "");
        } else if (arrayMode && currentKey && line.match(/^\s*-\s+/)) {
          if (objBuffer) {
            frontmatter[currentKey].push(objBuffer);
            objBuffer = null;
          }
          const item = line.replace(/^\s*-\s+/, "").trim();
          if (!Array.isArray(frontmatter[currentKey]))
            frontmatter[currentKey] = [];
          frontmatter[currentKey].push(item);
        }
      }
      if (objBuffer && currentKey) frontmatter[currentKey].push(objBuffer);
    }
    return { frontmatter, body };
  }

  function slugifyHeading(text) {
    return text
      .replace(/<[^>]+>/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function resolveContentLink(href) {
    if (
      !href ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      href.startsWith("/blog/post/") ||
      href.startsWith("/portfolio/") ||
      href.startsWith("/tag/") ||
      href.startsWith("/category/")
    )
      return href;
    const m = href.match(/^\/?(content\/)?blog\/(.+?)(?:#(.+))?$/);
    if (m) {
      const slug = m[2].replace(/\.md$/, "");
      return `/blog/post/${slug}${m[3] ? "#" + m[3] : ""}`;
    }
    const pm = href.match(/^\/?(content\/)?portfolio\/(.+?)(?:#(.+))?$/);
    if (pm) {
      const slug = pm[2].replace(/\.md$/, "");
      return `/portfolio/${slug}${pm[3] ? "#" + pm[3] : ""}`;
    }
    const pgm = href.match(/^\/?(content\/)?pages\/(.+?)(?:#(.+))?$/);
    if (pgm) {
      const slug = pgm[2].replace(/\.md$/, "");
      return `/${slug}${pgm[3] ? "#" + pgm[3] : ""}`;
    }
    return href;
  }

  // Processing depth counter to prevent storage clearing during nested processing
  window._processingDepth = window._processingDepth || 0;
  
  function renderMd(md, opts = {}) {
    window._processingDepth++;
    const renderer = new marked.Renderer();
    renderer.image = function (href, title, text) {
      const resolved = resolvePath(typeof href === "object" ? href.href : href);
      return `<img ${buildDetailImageAttrs(resolved, {
        alt: text || "",
        title: title || "",
        loading: "lazy",
      })}>`;
    };
    renderer.heading = function (tokenOrText, level) {
      const raw =
        typeof tokenOrText === "object" ? tokenOrText.text || "" : tokenOrText;
      const depth =
        typeof tokenOrText === "object"
          ? tokenOrText.depth || level || 1
          : level || 1;
      const id = slugifyHeading(raw);
      return `<h${depth} id="${id}">${raw}</h${depth}>\n`;
    };
    renderer.link = function (hrefOrToken, title, text) {
      const rawHref =
        typeof hrefOrToken === "object" ? hrefOrToken.href : hrefOrToken;
      const rawTitle =
        typeof hrefOrToken === "object" ? hrefOrToken.title : title;
      const rawText = typeof hrefOrToken === "object" ? hrefOrToken.text : text;
      const resolved = resolveContentLink(rawHref);
      const external =
        resolved.startsWith("http://") || resolved.startsWith("https://");
      return `<a href="${resolved}"${rawTitle ? ` title="${rawTitle}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${rawText || resolved}</a>`;
    };
    renderer.code = function (codeOrToken, infostring) {
      const rawCode =
        typeof codeOrToken === "object" ? codeOrToken.text || "" : codeOrToken || "";
      const rawLang =
        typeof codeOrToken === "object"
          ? codeOrToken.lang || ""
          : infostring || "";
        const lang = rawLang ? String(rawLang).trim().split(/\s+/)[0].toLowerCase() : "";
        if (lang === "chart") {
          const configText = rawCode.trim();
          chartStorage.push(configText);
          const encodedConfig = encodeURIComponent(configText);
          return `<div class="rk-chart-container" data-chart-idx="${chartStorage.length - 1}" data-chart-config="${escapeHtml(encodedConfig)}"></div>\n`;
      }
      const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${classAttr}>${escapeHtml(rawCode)}</code></pre>\n`;
    };
    marked.setOptions({
      renderer,
      highlight: function (code, lang) {
        return escapeHtml(code);
      },
      breaks: opts.breaks || false,
      gfm: true,
    });
    // Protect fenced code blocks and inline code from custom preprocessors
    // Reset chart storage only for top-level renderMd call to prevent clearing during nested processing
    if (window._processingDepth === 1) {
      chartStorage.length = 0;
      renderCodeBlocks.length = 0;
    }
    let protected_md = md
      .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, (m) => {
        renderCodeBlocks.push(m);
        return `\x02RAKSARA_CB_${renderCodeBlocks.length - 1}\x03`;
      })
      .replace(/`[^`\n]+`/g, (m) => {
        renderCodeBlocks.push(m);
        return `\x02RAKSARA_CB_${renderCodeBlocks.length - 1}\x03`;
      });
    const preprocessed = restoreRenderCodeBlocks(
      preprocessCustomGrid(
        preprocessCustomProgress(
          preprocessCustomThoughts(
            preprocessCustomComponents(
              preprocessCustomChips(
                preprocessCustomContainers(
                  preprocessCustomPanels(
                    preprocessChapters(
                      preprocessToc(
                        preprocessFileAttachments(protected_md)
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    );
    const rawHtml = marked.parse(preprocessed);
    const result = injectGrid(injectProgress(injectThoughts(injectCustomComponents(injectChips(injectContainers(injectPanels(injectToc(rawHtml))))))));
    window._processingDepth--;
    return result;
  }

  // ── TOC Custom Component ──────────────────────────────

  function preprocessToc(md) {
    return md.replace(/::toc\s*\(\s*([^)]*)\s*\)/g, (_m, params) => {
      const raw = String(params || "").trim();
      let type = "bullet";
      let maxLevel = 3;

      const typeMatch = raw.match(/(?:^|,)\s*type\s*=\s*(\w+)/i);
      const levelMatch = raw.match(/(?:^|,)\s*level\s*=\s*(\d+)/i);

      if (typeMatch || levelMatch) {
        if (typeMatch) type = typeMatch[1].toLowerCase();
        if (levelMatch) maxLevel = parseInt(levelMatch[1], 10);
      } else if (raw) {
        const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts[0]) type = parts[0].toLowerCase();
        if (parts[1]) maxLevel = parseInt(parts[1], 10);
      }

      if (type !== "bullet" && type !== "number") type = "bullet";
      if (!Number.isFinite(maxLevel)) maxLevel = 3;
      maxLevel = Math.min(6, Math.max(1, maxLevel));

      return `[[RAKSARA_TOC:${type}:${maxLevel}]]`;
    });
  }

  function injectToc(html) {
    if (!html.includes("[[RAKSARA_TOC:")) return html;
    const headings = [];
    const headingRe = /<h([1-6])[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let m;
    while ((m = headingRe.exec(html)) !== null) {
      headings.push({ level: parseInt(m[1]), id: m[2], text: m[3].replace(/<[^>]+>/g, "").trim() });
    }
    let tocCounter = 0;
    return html.replace(/(?:<p>)?\[\[RAKSARA_TOC:(\w+):(\d+)\]\](?:<\/p>)?/g, (_match, type, levelStr) => {
      const maxLevel = Number.isFinite(parseInt(levelStr, 10))
        ? Math.min(6, Math.max(1, parseInt(levelStr, 10)))
        : 3;
      const filtered = headings.filter((h) => h.level <= maxLevel);
      if (!filtered.length) return "";
      const tag = type === "number" ? "ol" : "ul";
      const minLevel = Math.min(...filtered.map((h) => h.level));
      const bullets = ["•", "◦", "▪", "▸", "–", "·"];
      const counters = {};
      const items = filtered
        .map((h) => {
          const indent = (h.level - minLevel) * 16;
          let marker;
          if (type === "number") {
            counters[h.level] = (counters[h.level] || 0) + 1;
            for (let l = h.level + 1; l <= 6; l++) counters[l] = 0;
            let label = "";
            for (let l = minLevel; l <= h.level; l++) label += (counters[l] || 0) + ".";
            marker = label;
          } else {
            marker = bullets[(h.level - minLevel) % bullets.length];
          }
          return `<li style="padding-left:${indent}px"><span class="toc-marker">${marker}</span><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`;
        })
        .join("");
      tocCounter += 1;
      const contentId = `toc-content-${tocCounter}`;
      return `<nav class="toc-block" aria-label="Table of contents">
        <div class="toc-head">
          <div class="toc-title">Table of Contents</div>
          <button type="button" class="toc-toggle-btn" data-toc-target="${contentId}" aria-expanded="true" aria-label="Collapse table of contents">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="toc-content" id="${contentId}">
          <${tag} class="toc-list">${items}</${tag}>
        </div>
      </nav>`;
    });
  }

  function initTocBlocks() {
    document.querySelectorAll(".toc-toggle-btn").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toc-target");
        if (!targetId) return;
        const content = document.getElementById(targetId);
        if (!content) return;
        const expanded = btn.getAttribute("aria-expanded") !== "false";
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        btn.setAttribute(
          "aria-label",
          expanded ? "Expand table of contents" : "Collapse table of contents",
        );
        content.hidden = expanded;
      });
    });
  }

  // ── Chapters Custom Component ─────────────────────────

  function preprocessChapters(md) {
    return md.replace(/::chapters\s*\(([^)]+)\)/g, (_m, pathArg) => {
      const clean = pathArg.trim().replace(/^\//, "");
      const parts = clean.split("/");
      // Strip trailing slashes: "novel/raging-sun-silent-moon/chapters/" → "…/chapters"
      const dirPath = (parts[0] === "blog" ? parts.slice(1).join("/") : clean).replace(/\/+$/, "");

      const dir = state.blogDirs && state.blogDirs[dirPath];
      const subdirs = dir ? (dir.subdirs || []) : [];
      const directPosts = dir
        ? (dir.posts || []).map(s => state.posts.find(p => p.slug === s)).filter(Boolean)
        : state.posts.filter(p => p.dir === dirPath || p.slug.startsWith(dirPath + "/") || (p.dir || "").startsWith(dirPath));

      const tableShell = (body) => {
        const blockId = `chb-${dirPath.replace(/[^a-z0-9]/gi, "-") || "root"}`;
        return `<div class="chapters-block" id="${blockId}"><table class="chapters-table" role="table" aria-label="Chapter list for ${escapeHtml(dirPath)}"><thead><tr><th class="chapters-th chapters-th-sortable" data-col="title" data-order="" scope="col">Title</th><th class="chapters-th chapters-th-sortable chapters-th-date" data-col="date" data-order="" scope="col">Date</th><th class="chapters-th chapters-th-type" scope="col">Type</th></tr></thead><tbody>${body}</tbody></table></div>`;
      };

      if (!directPosts.length && !subdirs.length) {
        return tableShell(`<tr class="chapters-row"><td class="chapters-cell-empty" colspan="3">No data</td></tr>`);
      }

      const sortByChapterDate = arr => [...arr].sort((a, b) => {
        const ca = parseInt(a.chapter) || 0, cb = parseInt(b.chapter) || 0;
        return ca !== cb ? ca - cb : new Date(a.date) - new Date(b.date);
      });

      const iconDir = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L9.354 4.646A.5.5 0 009.707 4.8H12.5A1.5 1.5 0 0114 6.3V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.3"/></svg>`;
      const iconPage = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M10 2v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
      const iconChevron = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="chapters-chevron" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      let rows = "";

      for (const subdir of subdirs) {
        const fullPath = dirPath ? `${dirPath}/${subdir}` : subdir;
        const childDir = state.blogDirs && state.blogDirs[fullPath];
        const childPosts = childDir
          ? sortByChapterDate((childDir.posts || []).map(s => state.posts.find(p => p.slug === s)).filter(Boolean))
          : [];
        const label = humanize(subdir);
        const dirId = fullPath.replace(/[^a-zA-Z0-9]/g, "-");

        rows += `<tr class="chapters-row chapters-row-dir" data-dir-id="${escapeHtml(dirId)}" data-expanded="false" data-title="${escapeHtml(label)}" data-date="">
          <td class="chapters-cell-title"><span class="chapters-dir-toggle">${iconChevron}</span><span class="chapters-dir-name">${escapeHtml(label)}</span>${childPosts.length ? `<span class="chapters-dir-badge">${childPosts.length}</span>` : ""}</td>
          <td class="chapters-cell-date">—</td>
          <td class="chapters-cell-type chapters-type-dir" title="Directory">${iconDir}</td>
        </tr>`;

        for (const p of childPosts) {
          rows += `<tr class="chapters-row chapters-row-child" data-parent-dir="${escapeHtml(dirId)}" data-slug="${escapeHtml(p.slug)}" hidden>
            <td class="chapters-cell-title chapters-cell-indented">${escapeHtml(p.title)}</td>
            <td class="chapters-cell-date">${formatDate(p.date)}</td>
            <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
          </tr>`;
        }
      }

      for (const p of sortByChapterDate(directPosts)) {
        rows += `<tr class="chapters-row chapters-row-page" data-slug="${escapeHtml(p.slug)}" data-title="${escapeHtml(p.title)}" data-date="${escapeHtml(p.date || "")}">
          <td class="chapters-cell-title">${escapeHtml(p.title)}</td>
          <td class="chapters-cell-date">${formatDate(p.date)}</td>
          <td class="chapters-cell-type chapters-type-page" title="Page">${iconPage}</td>
        </tr>`;
      }

      return tableShell(rows);
    });
  }

  function initChaptersBlocks() {
    const PAGE_SIZE = 10;

    document.querySelectorAll(".chapters-block:not([data-init])").forEach(block => {
      block.dataset.init = "1";
      const tbody = block.querySelector("tbody");
      if (!tbody) return;

      function getTopRows() {
        return Array.from(tbody.querySelectorAll(".chapters-row:not(.chapters-row-child)"));
      }

      function applyPagination() {
        block.querySelectorAll(".chapters-footer").forEach(f => f.remove());
        const topRows = getTopRows();
        if (topRows.length <= PAGE_SIZE) return;

        // Show first PAGE_SIZE; hide the rest and their children
        topRows.forEach((row, i) => {
          const visible = i < PAGE_SIZE;
          row.hidden = !visible;
          if (!visible && row.classList.contains("chapters-row-dir")) {
            const dId = row.dataset.dirId;
            tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => { c.hidden = true; });
          }
        });

        let shown = PAGE_SIZE;
        const footer = document.createElement("div");
        footer.className = "chapters-footer";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chapters-show-more";

        function updateBtn() {
          const remaining = topRows.length - shown;
          if (remaining <= 0) { footer.remove(); return; }
          btn.textContent = `Show more (${remaining} remaining)`;
        }

        btn.addEventListener("click", () => {
          topRows.slice(shown, shown + PAGE_SIZE).forEach(row => {
            row.hidden = false;
            if (row.classList.contains("chapters-row-dir")) {
              const dId = row.dataset.dirId;
              tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => {
                c.hidden = row.dataset.expanded !== "true";
              });
            }
          });
          shown += PAGE_SIZE;
          updateBtn();
        });

        updateBtn();
        footer.appendChild(btn);
        block.appendChild(footer);
      }

      // Sortable headers
      block.querySelectorAll(".chapters-th-sortable").forEach(th => {
        th.addEventListener("click", () => {
          const col = th.dataset.col;
          const next = th.dataset.order === "asc" ? "desc" : "asc";
          block.querySelectorAll(".chapters-th-sortable").forEach(h => { h.dataset.order = ""; });
          th.dataset.order = next;

          // Unhide all top-level rows before sorting; collapse all children
          const topRows = getTopRows();
          topRows.forEach(row => { row.hidden = false; });
          tbody.querySelectorAll(".chapters-row-child").forEach(c => { c.hidden = true; });

          topRows.sort((a, b) => {
            if (col === "date") {
              const ta = new Date(a.dataset.date || "").getTime() || 0;
              const tb = new Date(b.dataset.date || "").getTime() || 0;
              return next === "asc" ? ta - tb : tb - ta;
            }
            const va = (a.dataset.title || "").toLowerCase();
            const vb = (b.dataset.title || "").toLowerCase();
            return next === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
          });

          for (const row of topRows) {
            tbody.appendChild(row);
            if (row.classList.contains("chapters-row-dir")) {
              row.dataset.expanded = "false";
              const dId = row.dataset.dirId;
              tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => tbody.appendChild(c));
            }
          }

          // Re-apply pagination (collapses to first PAGE_SIZE)
          applyPagination();
        });
      });

      // Dir expand/collapse
      block.querySelectorAll(".chapters-row-dir").forEach(row => {
        row.addEventListener("click", () => {
          const dId = row.dataset.dirId;
          const expanded = row.dataset.expanded === "true";
          row.dataset.expanded = expanded ? "false" : "true";
          tbody.querySelectorAll(`[data-parent-dir="${dId}"]`).forEach(c => { c.hidden = expanded; });
        });
      });

      // Page/child row click to navigate
      block.addEventListener("click", e => {
        const row = e.target.closest(".chapters-row-page, .chapters-row-child[data-slug]");
        if (!row || e.target.closest(".chapters-row-dir")) return;
        const slug = row.dataset.slug;
        if (slug) navigateTo(toRouteHref(`/blog/post/${slug.split("/").map(encodeURIComponent).join("/")}`));
      });

      applyPagination();
    });
  }

  function initComponentLists() {
    document.querySelectorAll(".component-list-search").forEach((input) => {
      if (input.dataset.bound === "1") return;
      input.dataset.bound = "1";
      const listId = input.getAttribute("data-list");
      const list = listId ? document.getElementById(listId) : null;
      if (!list) return;
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        const cards = list.querySelectorAll(".component-card");
        let visible = 0;
        cards.forEach((card) => {
          const title = (card.getAttribute("data-title") || "").toLowerCase();
          const desc = (card.getAttribute("data-desc") || "").toLowerCase();
          const match = !q || title.includes(q) || desc.includes(q);
          card.style.display = match ? "" : "none";
          if (match) visible++;
        });
        // Show/hide empty state
        let empty = list.querySelector(".component-list-empty");
        if (!empty) {
          empty = document.createElement("p");
          empty.className = "component-list-empty";
          empty.textContent = "No components match your search.";
          list.appendChild(empty);
        }
        empty.style.display = visible === 0 ? "" : "none";
      });
    });
  }