  // ── Search Overlay ────────────────────────────────────
  function initSearch() {
    const trigger = document.getElementById("search-trigger");
    const overlay = document.getElementById("search-overlay");
    const input = document.getElementById("search-overlay-input");
    const results = document.getElementById("search-overlay-results");
    const backdrop = overlay.querySelector(".search-overlay-backdrop");
    let debounceTimer;

    const searchPhrases = [
      "Search posts...",
      "Search projects...",
      "Search thoughts...",
      "Search tags...",
    ];
    let phraseIdx = 0,
      phraseCharIdx = 0,
      phraseDir = 1,
      phraseTimer = null;

    function animatePlaceholder() {
      if (overlay.classList.contains("hidden") || input.value.length > 0)
        return;
      const phrase = searchPhrases[phraseIdx];
      if (phraseDir === 1) {
        phraseCharIdx++;
        if (phraseCharIdx > phrase.length) {
          phraseDir = -1;
          phraseTimer = setTimeout(animatePlaceholder, 2000);
          return;
        }
      } else {
        phraseCharIdx--;
        if (phraseCharIdx < 0) {
          phraseDir = 1;
          phraseIdx = (phraseIdx + 1) % searchPhrases.length;
          phraseCharIdx = 0;
          phraseTimer = setTimeout(animatePlaceholder, 400);
          return;
        }
      }
      input.setAttribute("placeholder", phrase.slice(0, phraseCharIdx));
      phraseTimer = setTimeout(animatePlaceholder, phraseDir === 1 ? 80 : 40);
    }

    async function openSearch() {
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      if (!state.miniSearch) {
        input.setAttribute("placeholder", "Loading search index...");
        try {
          await ensureMiniSearchReady();
          if (!state.miniSearch) {
            input.setAttribute("placeholder", "Search unavailable right now");
          }
        } catch (err) {
          console.warn("Search initialization failed:", err);
          input.setAttribute("placeholder", "Search unavailable right now");
        } finally {
          if (state.miniSearch) {
            input.setAttribute("placeholder", "Search posts, projects, pages...");
          }
        }
      }
      setTimeout(() => input.focus(), 50);
      phraseIdx = 0;
      phraseCharIdx = 0;
      phraseDir = 1;
      if (phraseTimer) clearTimeout(phraseTimer);
      animatePlaceholder();
    }

    function closeSearch() {
      overlay.classList.add("hidden");
      document.body.style.overflow = "";
      input.value = "";
      input.setAttribute("placeholder", "Search posts, projects, pages...");
      results.innerHTML = "";
      if (phraseTimer) {
        clearTimeout(phraseTimer);
        phraseTimer = null;
      }
    }

    trigger.addEventListener("click", openSearch);
    backdrop.addEventListener("click", closeSearch);

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") closeSearch();
    });

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      if (!input.value && !overlay.classList.contains("hidden")) {
        if (phraseTimer) clearTimeout(phraseTimer);
        phraseCharIdx = 0;
        phraseDir = 1;
        animatePlaceholder();
      }
      debounceTimer = setTimeout(() => {
        const query = input.value.trim();
        if (query.length < 2 || !state.miniSearch) {
          results.innerHTML = "";
          return;
        }
        const hits = state.miniSearch.search(query, { limit: 10 });
        if (!hits.length) {
          results.innerHTML =
            '<div class="search-empty">No results found</div>';
          return;
        }
        results.innerHTML = hits
          .map((h) => {
            let href = "/";
            if (h.section === "blog") href = `/blog/post/${h.slug}`;
            else if (h.section === "portfolio") href = `/portfolio/${h.slug}`;
            else if (h.section === "gallery") href = "/gallery";
            else if (h.section === "thoughts") href = "/thoughts";
            else if (h.section === "pages") href = `/${h.slug}`;
            return `<div class="search-result-item" data-href="${href}">
            <div class="search-result-title">${escapeHtml(h.title)}</div>
            <div class="search-result-meta">${escapeHtml(h.section)}${h.category ? " \u00B7 " + escapeHtml(h.category) : ""}</div>
          </div>`;
          })
          .join("");
        results.querySelectorAll(".search-result-item").forEach((item) => {
          item.addEventListener("click", () => {
            navigateTo(item.dataset.href);
            closeSearch();
          });
        });
      }, 150);
    });
  }