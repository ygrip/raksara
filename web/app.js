(function () {
  'use strict';

  const POSTS_PER_PAGE = 10;
  const state = {
    posts: [],
    portfolio: [],
    gallery: [],
    thoughts: [],
    pages: [],
    tags: {},
    categories: {},
    blogDirs: {},
    searchIndex: null,
    miniSearch: null,
    config: {},
    loaded: false,
  };

  // ── Data Loading ──────────────────────────────────────

  async function loadJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return res.json();
  }

  async function loadData() {
    if (state.loaded) return;
    try {
      const [posts, portfolio, gallery, thoughts, pages, tags, categories, blogDirs, searchIndex] = await Promise.all([
        loadJSON('metadata/posts.json'),
        loadJSON('metadata/portfolio.json'),
        loadJSON('metadata/gallery.json'),
        loadJSON('metadata/thoughts.json'),
        loadJSON('metadata/pages.json'),
        loadJSON('metadata/tags.json'),
        loadJSON('metadata/categories.json'),
        loadJSON('metadata/blog-dirs.json'),
        loadJSON('metadata/search-index.json'),
      ]);
      Object.assign(state, { posts, portfolio, gallery, thoughts, pages, tags, categories, blogDirs, searchIndex, loaded: true });

      state.miniSearch = MiniSearch.loadJS(searchIndex, {
        fields: ['title', 'tags', 'category', 'body'],
        storeFields: ['title', 'section', 'slug', 'category'],
      });

      try { state.config = await loadJSON('metadata/config.json'); } catch { state.config = {}; }
      applyAccentColor((state.config && state.config.color) || 'purple');
      if (state.config.logo) applyLogo('content/' + state.config.logo);
    } catch (err) {
      console.error('Error loading data:', err);
      showContent('<div class="empty-state"><h3>Failed to load data</h3><p>Run: npm run build</p></div>');
    }
  }

  async function loadMarkdown(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.text();
  }

  function parseMarkdown(text) {
    const gm = text.match(/^---\n([\s\S]*?)\n---/);
    let frontmatter = {};
    let body = text;
    if (gm) {
      body = text.slice(gm[0].length);
      const lines = gm[1].split('\n');
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
          const val = kv[2].trim().replace(/^["']|["']$/g, '');
          if (val === '') {
            frontmatter[currentKey] = [];
            arrayMode = true;
          } else {
            frontmatter[currentKey] = val;
            arrayMode = false;
          }
        } else if (arrayMode && currentKey && line.match(/^\s+-\s+\w[\w-]*:/)) {
          if (objBuffer) frontmatter[currentKey].push(objBuffer);
          const objKv = line.match(/^\s+-\s+(\w[\w-]*):\s*(.*)$/);
          objBuffer = {};
          if (objKv) objBuffer[objKv[1]] = objKv[2].trim().replace(/^["']|["']$/g, '');
        } else if (objBuffer && line.match(/^\s+\w[\w-]*:/)) {
          const nestedKv = line.match(/^\s+(\w[\w-]*):\s*(.*)$/);
          if (nestedKv) objBuffer[nestedKv[1]] = nestedKv[2].trim().replace(/^["']|["']$/g, '');
        } else if (arrayMode && currentKey && line.match(/^\s+-\s+/)) {
          if (objBuffer) { frontmatter[currentKey].push(objBuffer); objBuffer = null; }
          const item = line.replace(/^\s+-\s+/, '').trim();
          if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = [];
          frontmatter[currentKey].push(item);
        }
      }
      if (objBuffer && currentKey) frontmatter[currentKey].push(objBuffer);
    }
    return { frontmatter, body };
  }

  function slugifyHeading(text) {
    return text.replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  function resolveContentLink(href) {
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('#')) return href;
    const m = href.match(/^\/?(content\/)?blog\/(.+?)(?:#(.+))?$/);
    if (m) {
      const slug = m[2].replace(/\.md$/, '');
      return `#/blog/post/${slug}${m[3] ? '#' + m[3] : ''}`;
    }
    const pm = href.match(/^\/?(content\/)?portfolio\/(.+?)(?:#(.+))?$/);
    if (pm) {
      const slug = pm[2].replace(/\.md$/, '');
      return `#/portfolio/${slug}${pm[3] ? '#' + pm[3] : ''}`;
    }
    const pgm = href.match(/^\/?(content\/)?pages\/(.+?)(?:#(.+))?$/);
    if (pgm) {
      const slug = pgm[2].replace(/\.md$/, '');
      return `#/${slug}${pgm[3] ? '#' + pgm[3] : ''}`;
    }
    return href;
  }

  function renderMd(md, opts = {}) {
    const renderer = new marked.Renderer();
    renderer.image = function (href, title, text) {
      const resolved = resolvePath(typeof href === 'object' ? href.href : href);
      return `<img src="${resolved}" alt="${text || ''}"${title ? ` title="${title}"` : ''} loading="lazy">`;
    };
    renderer.heading = function (tokenOrText, level) {
      const raw = typeof tokenOrText === 'object' ? (tokenOrText.text || '') : tokenOrText;
      const depth = typeof tokenOrText === 'object' ? (tokenOrText.depth || level || 1) : (level || 1);
      const id = slugifyHeading(raw);
      return `<h${depth} id="${id}">${raw}</h${depth}>\n`;
    };
    renderer.link = function (hrefOrToken, title, text) {
      const rawHref = typeof hrefOrToken === 'object' ? hrefOrToken.href : hrefOrToken;
      const rawTitle = typeof hrefOrToken === 'object' ? hrefOrToken.title : title;
      const rawText = typeof hrefOrToken === 'object' ? hrefOrToken.text : text;
      const resolved = resolveContentLink(rawHref);
      const external = resolved.startsWith('http://') || resolved.startsWith('https://');
      return `<a href="${resolved}"${rawTitle ? ` title="${rawTitle}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${rawText || resolved}</a>`;
    };
    marked.setOptions({
      renderer,
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
        return hljs.highlightAuto(code).value;
      },
      breaks: opts.breaks || false,
      gfm: true,
    });
    return marked.parse(md);
  }

  // ── Rendering Helpers ─────────────────────────────────

  function showContent(html) {
    const el = document.getElementById('page-content');
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.innerHTML = html;
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    window.scrollTo(0, 0);
  }

  function showLoading() {
    showContent('<div class="loading">Loading...</div>');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function resolvePath(p) {
    if (!p) return p;
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
    return p.replace(/^\/+/, '');
  }

  function getGalleryImages(g) {
    if (g.images && g.images.length > 0) return g.images;
    if (g.image) return [{ src: g.image, caption: g.caption || '' }];
    return [];
  }

  function initLazyImages(root) {
    (root || document).querySelectorAll('img[loading="lazy"]:not(.loaded)').forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
        img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
      }
    });
  }

  // ── Page Renderers ────────────────────────────────────

  let _typingTimer = null;

  function initHeroTyping(title) {
    if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null; }
    const span = document.querySelector('.accent-gradient');
    if (!span) return;
    span.textContent = '';
    span.classList.remove('typed');
    const cursor = document.createElement('span');
    cursor.className = 'hero-cursor';
    cursor.textContent = '|';
    span.after(cursor);
    const chars = title.split('');
    const total = chars.length;
    const slowCount = 3;
    const baseDelay = 70;
    let i = 0;
    function typeNext() {
      if (i >= total) {
        cursor.classList.add('hero-cursor-done');
        _typingTimer = setTimeout(() => { cursor.remove(); span.classList.add('typed'); _typingTimer = null; }, 600);
        return;
      }
      span.textContent += chars[i];
      const remaining = total - i - 1;
      let delay = baseDelay;
      if (remaining < slowCount) delay = baseDelay * Math.pow(2.5, slowCount - remaining);
      i++;
      _typingTimer = setTimeout(typeNext, delay);
    }
    _typingTimer = setTimeout(typeNext, 400);
  }

  function renderHome() {
    const recentPosts = state.posts.slice(0, 3);
    const recentThoughts = state.thoughts.slice(0, 2);

    let postsHtml = recentPosts.map(renderPostCard).join('');

    let portfolioHtml = state.portfolio.slice(0, 4).map((p) => renderPortfolioCard(p)).join('');

    let thoughtsHtml = recentThoughts.map((t) => renderThoughtCard(t)).join('');

    let galleryHtml = state.gallery.slice(0, 4).map((g) => {
      const images = getGalleryImages(g);
      if (!images.length) return '';
      const imgSrc = resolvePath(images[0].src);
      const isMulti = images.length > 1;
      const countBadge = isMulti ? `<div class="gallery-image-count"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="9" height="9" rx="1.5"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>${images.length}</div>` : '';
      return `
      <div class="gallery-item${isMulti ? ' multi-image' : ''}" onclick="window.__openGallery(${state.gallery.indexOf(g)})">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(g.title)}" loading="lazy">
        <div class="gallery-item-overlay">
          <div class="gallery-item-title">${escapeHtml(g.title)}</div>
        </div>
        ${countBadge}
      </div>`;
    }).join('');

    const heroTitle = (state.config && state.config.hero_title) || 'Raksara';
    const heroSubtitle = (state.config && state.config.hero_subtitle) || 'A place where ideas, knowledge, and engineering thoughts are recorded.';

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
        <div class="home-section-header"><h2>Recent Posts</h2><a href="#/blog">View all \u2192</a></div>
        <div class="post-list">${postsHtml || '<div class="empty-state"><p>No posts yet.</p></div>'}</div>
      </div>

      ${thoughtsHtml ? `<div class="home-section">
        <div class="home-section-header"><h2>Shower Thoughts</h2><a href="#/thoughts">View all \u2192</a></div>
        <div class="thoughts-list">${thoughtsHtml}</div>
      </div>` : ''}

      <div class="home-section">
        <div class="home-section-header"><h2>Projects</h2><a href="#/portfolio">View all \u2192</a></div>
        <div class="portfolio-grid">${portfolioHtml || '<div class="empty-state"><p>No projects yet.</p></div>'}</div>
      </div>

      ${galleryHtml ? `<div class="home-section">
        <div class="home-section-header"><h2>Gallery</h2><a href="#/gallery">View all \u2192</a></div>
        <div class="gallery-grid">${galleryHtml}</div>
      </div>` : ''}
    `);
    initParallax();
    initPortfolioCards();
    initLazyImages();
    initHeroTyping(heroTitle);
  }

  // ── Blog ──────────────────────────────────────────────

  function humanize(slug) {
    return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function blogBreadcrumbs(segments, options) {
    const { linkLast = false, lastLabel = '' } = options || {};
    let html = '<nav class="breadcrumbs"><a href="#/blog">Blog</a>';
    let accum = '';
    for (let i = 0; i < segments.length; i++) {
      accum += (accum ? '/' : '') + segments[i];
      const isLast = i === segments.length - 1;
      const label = isLast && lastLabel ? lastLabel : humanize(segments[i]);
      if (isLast && !linkLast) {
        html += `<span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${escapeHtml(label)}</span>`;
      } else {
        html += `<span class="breadcrumb-sep">/</span><a href="#/blog/dir/${accum}">${escapeHtml(label)}</a>`;
      }
    }
    html += '</nav>';
    return html;
  }

  function renderPostCard(p) {
    const coverSrc = p.cover ? resolvePath(p.cover) : '';
    const thumbHtml = coverSrc
      ? `<div class="post-card-thumb"><img src="${escapeHtml(coverSrc)}" alt="" loading="lazy"></div>`
      : '';
    return `
      <a href="#/blog/post/${p.slug}" class="post-card${coverSrc ? ' has-thumb' : ''}">
        ${thumbHtml}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(p.title)}</div>
          <div class="post-card-summary">${escapeHtml(p.summary || '')}</div>
          <div class="post-card-meta">
            <span class="post-card-date">${formatDate(p.date)}</span>
            ${p.category ? `<span class="post-card-category">${escapeHtml(p.category)}</span>` : ''}
            ${(p.tags || []).map((t) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      </a>`;
  }

  function renderBlogDir(dirPath) {
    const dir = state.blogDirs[dirPath];
    if (!dir) { showContent('<div class="empty-state"><h3>Directory not found</h3></div>'); return; }

    const isRoot = dirPath === '';
    const segments = dirPath ? dirPath.split('/') : [];
    const breadcrumbsHtml = isRoot ? '' : blogBreadcrumbs(segments);
    const title = isRoot ? 'Blog' : humanize(segments[segments.length - 1]);

    let foldersHtml = '';
    if (dir.subdirs.length) {
      foldersHtml = '<div class="blog-dir-folders">' + dir.subdirs.map((d) => {
        const fullDir = dirPath ? dirPath + '/' + d : d;
        const childDir = state.blogDirs[fullDir];
        const count = childDir ? childDir.posts.length + childDir.subdirs.length : 0;
        return `<a href="#/blog/dir/${fullDir}" class="blog-dir-chip">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3h3.586a1.5 1.5 0 011.06.44L8.854 4.145A.5.5 0 009.207 4.3H12.5A1.5 1.5 0 0114 5.8V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>${escapeHtml(humanize(d))}</span>
          ${count ? `<span class="blog-dir-count">${count}</span>` : ''}
        </a>`;
      }).join('') + '</div>';
    }

    const dirPosts = dir.posts.map((slug) => state.posts.find((p) => p.slug === slug)).filter(Boolean);
    dirPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    const total = dirPosts.length;
    const postsHtml = dirPosts.map(renderPostCard).join('');
    const subtitle = isRoot
      ? `${state.posts.length} post${state.posts.length !== 1 ? 's' : ''}`
      : `${total} post${total !== 1 ? 's' : ''} in this directory`;

    showContent(`
      ${breadcrumbsHtml}
      <div class="page-header">
        <div>
          <h1 class="page-title">${escapeHtml(title)}</h1>
          <p class="page-subtitle">${subtitle}</p>
        </div>
        ${shareButton(title)}
      </div>
      ${foldersHtml}
      <div class="post-list">${postsHtml || '<div class="empty-state"><p>No posts in this directory.</p></div>'}</div>
    `);
    initShareButton(title, { isDirectory: true, pageCount: isRoot ? state.posts.length : total, dirPostTitles: dirPosts.slice(0, 4).map(p => p.title) });
    initLazyImages();
  }

  // ── Content Type System ───────────────────────────────

  const contentLayouts = {
    default: {
      bodyClass: '',
      handlesCover: false,
      renderBody(body) { return `<div class="article-body">${renderMd(body)}</div>`; },
      headerLayout: 'standard',
    },
    poem: {
      bodyClass: 'poem-layout',
      handlesCover: true,
      renderBody(body, frontmatter) {
        const coverUrl = frontmatter.cover || '';
        const coverHtml = coverUrl
          ? `<div class="poem-cover"><img src="${escapeHtml(coverUrl)}" alt="" loading="lazy"></div>`
          : '';
        return `<div class="article-body poem-body">${coverHtml}${renderMd(body, { breaks: true })}</div>`;
      },
      headerLayout: 'poem',
    },
    novel: {
      bodyClass: 'novel-layout',
      handlesCover: false,
      renderBody(body, frontmatter) {
        const series = frontmatter.series || '';
        const chapter = frontmatter.chapter || '';
        const seriesHtml = series ? `<div class="novel-series">${escapeHtml(humanize(series))}</div>` : '';
        const chapterHtml = chapter ? `<div class="novel-chapter">Chapter ${escapeHtml(chapter)}</div>` : '';
        return `${seriesHtml}${chapterHtml}<div class="article-body novel-body">${renderMd(body)}</div>`;
      },
      headerLayout: 'novel',
    },
  };

  function getContentLayout(type) {
    return contentLayouts[type] || contentLayouts.default;
  }

  function readingModeButton() {
    return `<button class="reading-mode-btn" aria-label="Reading Mode">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M2 6.5h12M2 10h8M2 13.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <span>Read</span>
    </button>`;
  }

  function initReadingMode(frontmatter) {
    const btn = document.querySelector('.reading-mode-btn');
    if (!btn) return;
    const autoEnable = frontmatter && (frontmatter.readingMode === 'true' || frontmatter.readingMode === true);
    if (autoEnable) {
      document.body.classList.add('reading-mode');
      btn.querySelector('span').textContent = 'Exit';
    }
    btn.addEventListener('click', () => {
      document.body.classList.toggle('reading-mode');
      const active = document.body.classList.contains('reading-mode');
      btn.querySelector('span').textContent = active ? 'Exit' : 'Read';
    });
  }

  function scrollToAnchor() {
    const fullHash = window.location.hash;
    const anchorIdx = fullHash.indexOf('#', 1);
    if (anchorIdx === -1) return;
    const anchor = fullHash.slice(anchorIdx + 1);
    if (!anchor) return;
    setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function initContentLinks() {
    document.querySelectorAll('.article-body a[href^="#/"]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = a.getAttribute('href').slice(1);
      });
    });
  }

  async function renderBlogPost(slug) {
    showLoading();
    const post = state.posts.find((p) => p.slug === slug);
    if (!post) { showContent('<div class="empty-state"><h3>Post not found</h3></div>'); return; }
    try {
      const raw = await loadMarkdown(post.path);
      const { frontmatter, body } = parseMarkdown(raw);
      const readTime = Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
      const type = frontmatter.type || post.type || 'default';
      const layout = getContentLayout(type);
      const bodyHtml = layout.renderBody(body, frontmatter);
      const tagsHtml = (post.tags || []).map((t) => `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');

      const slugParts = slug.split('/');
      const parentDir = slugParts.length > 1 ? slugParts.slice(0, -1).join('/') : '';
      const backHref = parentDir ? `#/blog/dir/${parentDir}` : '#/blog';
      const backLabel = parentDir ? humanize(slugParts[slugParts.length - 2]) : 'blog';
      const breadcrumbsHtml = slugParts.length > 1
        ? blogBreadcrumbs(slugParts, { linkLast: false, lastLabel: post.title })
        : '';

      const np = frontmatter.next_page;
      const pp = frontmatter.previous_page;
      const nextPage = Array.isArray(np) && np.length ? np[0] : (typeof np === 'object' && np ? np : null);
      const prevPage = Array.isArray(pp) && pp.length ? pp[0] : (typeof pp === 'object' && pp ? pp : null);
      let postNavHtml = '';
      if (prevPage || nextPage) {
        postNavHtml = '<div class="post-nav">';
        if (prevPage && prevPage.link) {
          postNavHtml += `<a href="${escapeHtml(prevPage.link)}" class="post-nav-link prev">
            <span class="post-nav-label">\u2190 Previous</span>
            <span class="post-nav-title">${escapeHtml(prevPage.title || 'Previous Page')}</span>
          </a>`;
        } else {
          postNavHtml += '<div></div>';
        }
        if (nextPage && nextPage.link) {
          postNavHtml += `<a href="${escapeHtml(nextPage.link)}" class="post-nav-link next">
            <span class="post-nav-label">Next \u2192</span>
            <span class="post-nav-title">${escapeHtml(nextPage.title || 'Next Page')}</span>
          </a>`;
        }
        postNavHtml += '</div>';
      }

      const headerHtml = layout.headerLayout === 'poem'
        ? `<div class="article-header poem-header">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
              <span class="post-card-date">${formatDate(post.date)}</span>
              ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ''}
              ${tagsHtml}
            </div>
          </div>`
        : `<div class="article-header">
            <h1>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
              <span class="post-card-date">${formatDate(post.date)}</span>
              ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ''}
              ${tagsHtml}
            </div>
          </div>`;

      const coverUrl = resolvePath(frontmatter.cover || post.cover) || '';
      const coverHtml = (coverUrl && !layout.handlesCover)
        ? `<div class="article-cover"><img src="${escapeHtml(coverUrl)}" alt="" loading="lazy"></div>`
        : '';

      if (layout.bodyClass) document.getElementById('page-content').setAttribute('data-layout', type);
      else document.getElementById('page-content').removeAttribute('data-layout');

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
        ${contentFooter(frontmatter.author)}
      `);
      initShareButton(post.title, { coverUrl, author: frontmatter.author, readTime, summary: post.summary, category: post.category, tags: post.tags });
      initReadingMode(frontmatter);
      initArticleImages();
      initContentLinks();
      scrollToAnchor();
    } catch { showContent('<div class="empty-state"><h3>Failed to load post</h3></div>'); }
  }

  // ── Portfolio ─────────────────────────────────────────

  function renderPortfolioCard(p) {
    const tagsHtml = (p.tags || []).map((t) => `<span class="tag" style="padding:3px 10px;font-size:11px">${escapeHtml(t)}</span>`).join('');
    const links = [];
    if (p.github) links.push(`<a href="${escapeHtml(p.github)}" class="btn-github" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>`);
    if (p.demo) links.push(`<a href="${escapeHtml(p.demo)}" class="btn-demo" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Demo</a>`);
    return `
      <div class="portfolio-card" data-href="#/portfolio/${p.slug}">
        <div class="portfolio-card-title">${escapeHtml(p.title)}</div>
        <div class="portfolio-card-summary">${escapeHtml(p.summary || '')}</div>
        <div class="portfolio-card-tags">${tagsHtml}</div>
        ${links.length ? `<div class="portfolio-card-links">${links.join('')}</div>` : ''}
      </div>`;
  }

  function renderPortfolioList() {
    const sorted = [...state.portfolio].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    const groups = {};
    for (const p of sorted) {
      const year = p.date && p.date !== '1970-01-01' ? new Date(p.date + 'T00:00:00').getFullYear().toString() : 'Other';
      if (!groups[year]) groups[year] = [];
      groups[year].push(p);
    }

    const years = Object.keys(groups).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return parseInt(b) - parseInt(a);
    });

    const timelineHtml = years.map(year => {
      const items = groups[year].map(p =>
        `<div class="timeline-item">${renderPortfolioCard(p)}</div>`
      ).join('');
      return `<div class="timeline-year">
        <div class="timeline-year-label">${escapeHtml(year)}</div>
        ${items}
      </div>`;
    }).join('');

    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Portfolio</h1>
          <p class="page-subtitle">${state.portfolio.length} project${state.portfolio.length !== 1 ? 's' : ''}</p>
        </div>
        ${shareButton('Portfolio')}
      </div>
      <div class="timeline">${timelineHtml}</div>
    `);
    initShareButton('Portfolio', { isDirectory: true, pageCount: state.portfolio.length, dirPostTitles: sorted.slice(0, 4).map(p => p.title), pageLabel: 'project' });
    initPortfolioCards();
  }

  function initPortfolioCards() {
    document.querySelectorAll('.portfolio-card[data-href]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        window.location.hash = card.dataset.href;
      });
    });
  }

  async function renderPortfolioItem(slug) {
    showLoading();
    const item = state.portfolio.find((p) => p.slug === slug);
    if (!item) { showContent('<div class="empty-state"><h3>Project not found</h3></div>'); return; }
    try {
      const raw = await loadMarkdown(item.path);
      const { frontmatter, body } = parseMarkdown(raw);
      const readTime = Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 200));
      const html = renderMd(body);
      const tagsHtml = (item.tags || []).map((t) => `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');
      const links = [];
      if (item.github) links.push(`<a href="${escapeHtml(item.github)}" class="btn-github" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>`);
      if (item.demo) links.push(`<a href="${escapeHtml(item.demo)}" class="btn-demo" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Live Demo</a>`);
      document.getElementById('page-content').removeAttribute('data-layout');
      showContent(`
        <div class="article-top-bar">
          <a href="#/portfolio" class="back-link">\u2190 Back to portfolio</a>
          ${shareButton(item.title)}
        </div>
        <div class="article-header">
          <h1>${escapeHtml(item.title)}</h1>
          <div class="article-meta">
            ${item.category ? `<span class="post-card-category">${escapeHtml(item.category)}</span>` : ''}
            ${tagsHtml}
          </div>
          ${links.length ? `<div class="portfolio-detail-links">${links.join('')}</div>` : ''}
        </div>
        <div class="article-body">${html}</div>
        ${contentFooter(frontmatter.author)}
      `);
      initShareButton(item.title, { author: frontmatter.author, readTime, summary: item.summary, category: item.category, tags: item.tags, isPortfolioDetail: true });
      initArticleImages();
      initContentLinks();
      scrollToAnchor();
    } catch { showContent('<div class="empty-state"><h3>Failed to load project</h3></div>'); }
  }

  // ── Gallery ───────────────────────────────────────────

  function renderGallery(autoOpenIndex) {
    const shareIconSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const items = state.gallery.map((g, galleryIndex) => {
      const images = getGalleryImages(g);
      if (!images.length) return '';
      const imgSrc = resolvePath(images[0].src);
      const isMulti = images.length > 1;
      const countBadge = isMulti ? `<div class="gallery-image-count"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="9" height="9" rx="1.5"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>${images.length}</div>` : '';
      const desc = g.description || '';
      const hasLongDesc = desc.length > 120;
      return `
      <div class="gallery-card${isMulti ? ' multi-image' : ''}">
        <div class="gallery-card-img" onclick="window.__openGallery(${galleryIndex})">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(g.title)}" loading="lazy">
          ${countBadge}
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-header">
            <div class="gallery-card-title">${escapeHtml(g.title)}</div>
            <button class="gallery-share-btn" data-gallery-index="${galleryIndex}" data-gallery-title="${escapeHtml(g.title)}" aria-label="Share image">${shareIconSvg}</button>
          </div>
          ${g.caption ? `<div class="gallery-card-caption">${escapeHtml(g.caption)}</div>` : ''}
          ${desc ? `<div class="gallery-card-desc${hasLongDesc ? ' collapsed' : ''}">
            <div class="gallery-card-desc-text">${escapeHtml(desc)}</div>
            ${hasLongDesc ? '<button class="gallery-card-toggle">Show more</button>' : ''}
          </div>` : ''}
          <div class="gallery-card-footer"><div class="gallery-card-date">${formatDate(g.date)}</div></div>
        </div>
      </div>`;
    }).join('');

    const galleryImageUrls = state.gallery.slice(0, 4).map(g => {
      const imgs = getGalleryImages(g);
      return imgs.length ? resolvePath(imgs[0].src) : '';
    }).filter(Boolean);

    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Gallery</h1>
          <p class="page-subtitle">${state.gallery.length} photo${state.gallery.length !== 1 ? 's' : ''}</p>
        </div>
        ${shareButton('Gallery')}
      </div>
      <div class="gallery-list">${items}</div>
    `);
    initShareButton('Gallery', { isGallery: true, galleryImageUrls, galleryCount: state.gallery.length });
    initGalleryToggles();
    initGalleryShareButtons();
    initLazyImages();
    if (typeof autoOpenIndex === 'number' && autoOpenIndex >= 0) {
      setTimeout(() => window.__openGallery(autoOpenIndex), 100);
    }
  }

  function initGalleryToggles() {
    document.querySelectorAll('.gallery-card-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const desc = btn.closest('.gallery-card-desc');
        const isCollapsed = desc.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? 'Show more' : 'Show less';
      });
    });
  }

  function initGalleryShareButtons() {
    document.querySelectorAll('.gallery-share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.galleryIndex;
        const title = btn.dataset.galleryTitle;
        const baseUrl = window.location.origin + window.location.pathname;
        const url = baseUrl + '#/gallery/' + idx;
        navigator.clipboard.writeText(title + ' : ' + url).then(() => {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 2000);
        }).catch(() => {});
      });
    });
  }

  // ── Thoughts ──────────────────────────────────────────

  function renderThoughtCard(t) {
    const tagsHtml = (t.tags || []).map((tag) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(tag)}</span>`).join('');
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

  function renderThoughts() {
    const html = state.thoughts.map(renderThoughtCard).join('');
    showContent(`
      <div class="page-header">
        <div>
          <h1 class="page-title">Shower Thoughts</h1>
          <p class="page-subtitle">Random ideas that pop in my mind</p>
        </div>
        ${shareButton('Shower Thoughts')}
      </div>
      <div class="thoughts-list">${html || '<div class="empty-state"><p>No thoughts yet. Brain empty.</p></div>'}</div>
    `);
    initShareButton('Shower Thoughts', { isThoughts: true });
  }

  // ── Shared filtered item renderer ─────────────────────

  function itemHref(item) {
    if (item.section === 'blog') return `#/blog/post/${item.slug}`;
    if (item.section === 'portfolio') return `#/portfolio/${item.slug}`;
    if (item.section === 'gallery') return `#/gallery`;
    if (item.section === 'thoughts') return `#/thoughts`;
    return `#/${item.slug}`;
  }

  function renderFilteredItem(item) {
    const sectionLabel = item.section ? `<span class="post-card-category">${escapeHtml(item.section)}</span>` : '';
    const coverSrc = item.cover ? resolvePath(item.cover) : '';
    const thumbHtml = coverSrc
      ? `<div class="post-card-thumb"><img src="${escapeHtml(coverSrc)}" alt="" loading="lazy"></div>`
      : '';
    return `
      <a href="${itemHref(item)}" class="post-card${coverSrc ? ' has-thumb' : ''}">
        ${thumbHtml}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(item.title)}</div>
          <div class="post-card-summary">${escapeHtml(item.summary || item.body || '')}</div>
          <div class="post-card-meta">
            ${item.date ? `<span class="post-card-date">${formatDate(item.date)}</span>` : ''}
            ${sectionLabel}
          </div>
        </div>
      </a>`;
  }

  // ── Tags & Categories ─────────────────────────────────

  function renderTags() {
    const sorted = Object.entries(state.tags).sort((a, b) => b[1] - a[1]);
    const tagsHtml = sorted.map(([tag, count]) =>
      `<a href="#/tag/${encodeURIComponent(tag)}" class="tag">${escapeHtml(tag)} <span class="tag-count">${count}</span></a>`
    ).join('');
    showContent(`<h1 class="page-title">Tags</h1><p class="page-subtitle">${sorted.length} tag${sorted.length !== 1 ? 's' : ''}</p><div class="tag-cloud">${tagsHtml}</div>`);
  }

  function renderTagPosts(tag) {
    const allItems = [...state.posts, ...state.portfolio, ...state.gallery, ...state.thoughts];
    const filtered = allItems.filter((p) => (p.tags || []).includes(tag));
    const html = filtered.map((item) => renderFilteredItem(item)).join('');
    showContent(`
      <a href="#/tags" class="back-link">\u2190 All tags</a>
      <h1 class="page-title">Tag: ${escapeHtml(tag)}</h1>
      <p class="page-subtitle">${filtered.length} item${filtered.length !== 1 ? 's' : ''}</p>
      <div class="post-list">${html || '<div class="empty-state"><p>No items with this tag.</p></div>'}</div>
    `);
    initLazyImages();
  }

  function renderCategories() {
    const sorted = Object.entries(state.categories).sort((a, b) => b[1] - a[1]);
    const html = sorted.map(([cat, count]) =>
      `<a href="#/category/${encodeURIComponent(cat)}" class="tag">${escapeHtml(cat)} <span class="tag-count">${count}</span></a>`
    ).join('');
    showContent(`<h1 class="page-title">Categories</h1><p class="page-subtitle">${sorted.length} categor${sorted.length !== 1 ? 'ies' : 'y'}</p><div class="tag-cloud">${html}</div>`);
  }

  function renderCategoryPosts(category) {
    const allItems = [...state.posts, ...state.portfolio, ...state.gallery, ...state.thoughts];
    const filtered = allItems.filter((p) => p.category === category);
    const html = filtered.map((item) => renderFilteredItem(item)).join('');
    showContent(`
      <a href="#/categories" class="back-link">\u2190 All categories</a>
      <h1 class="page-title">Category: ${escapeHtml(category)}</h1>
      <p class="page-subtitle">${filtered.length} item${filtered.length !== 1 ? 's' : ''}</p>
      <div class="post-list">${html || '<div class="empty-state"><p>No items in this category.</p></div>'}</div>
    `);
    initLazyImages();
  }

  // ── Profile (Parallax Hero) ───────────────────────────

  async function renderProfile() {
    showLoading();
    const page = state.pages.find((p) => p.slug === 'profile');
    const path = page ? page.path : 'content/pages/profile.md';
    try {
      const raw = await loadMarkdown(path);
      const { frontmatter, body } = parseMarkdown(raw);
      const html = renderMd(body);

      const coverUrl = resolvePath(frontmatter.cover) || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80';
      const avatarUrl = resolvePath(frontmatter.avatar) || '';
      const name = frontmatter.title || 'Profile';
      const role = frontmatter.role || '';

      const linkDefs = {
        github: { label: 'GitHub', prefix: '' },
        linkedin: { label: 'LinkedIn', prefix: '' },
        medium: { label: 'Medium', prefix: '' },
        twitter: { label: 'Twitter', prefix: '' },
        website: { label: 'Website', prefix: '' },
        email: { label: 'Email', prefix: 'mailto:' },
      };
      const links = [];
      for (const [key, def] of Object.entries(linkDefs)) {
        if (frontmatter[key]) links.push(`<a href="${def.prefix}${escapeHtml(frontmatter[key])}" target="_blank" rel="noopener">${def.label}</a>`);
      }

      const metaItems = Array.isArray(frontmatter.metadata) ? frontmatter.metadata : [];
      let metaHtml = '';
      if (metaItems.length) {
        metaHtml = '<div class="profile-metadata">' + metaItems.map((m) => {
          if (typeof m === 'string') return `<span class="profile-meta-chip">${escapeHtml(m)}</span>`;
          const label = m.label || '';
          const value = m.value || '';
          const url = m.url || '';
          const display = value || label;
          if (url) return `<a href="${escapeHtml(url)}" class="profile-meta-chip has-link" target="_blank" rel="noopener">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ''}${escapeHtml(display !== label ? display : '')}</a>`;
          return `<span class="profile-meta-chip">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ''}${escapeHtml(display !== label ? display : '')}</span>`;
        }).join('') + '</div>';
      }

      const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg></div>`;

      showContent(`
        <div class="profile-hero" id="profile-hero">
          <div class="profile-hero-bg" id="profile-hero-bg" data-src="${escapeHtml(coverUrl)}"></div>
          <div class="profile-hero-skeleton"></div>
          <div class="profile-hero-overlay"></div>
          <div class="profile-hero-share">${shareButton(name)}</div>
          <div class="profile-hero-content">
            ${avatarUrl ? `<div class="profile-avatar-wrap"><img class="profile-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" loading="lazy"></div>` : ''}
            <div class="profile-info">
              <h1>${escapeHtml(name)}</h1>
              ${role ? `<div class="profile-role">${escapeHtml(role)}</div>` : ''}
              ${links.length ? `<div class="profile-links">${links.join('')}</div>` : ''}
            </div>
          </div>
          ${waveSvg}
        </div>
        ${metaHtml}
        <div class="article-body">${html}</div>
      `);
      initParallax();
      const metaForShare = metaItems.slice(0, 3).map(m => typeof m === 'string' ? { label: m, value: '' } : { label: m.label || '', value: m.value || '' });
      initShareButton(name, { isProfile: true, coverUrl, avatarUrl, role, metadata: metaForShare });
      initProfileMedia(coverUrl);
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Profile not found</h3></div>'); }
  }

  function initProfileMedia(coverUrl) {
    const bg = document.getElementById('profile-hero-bg');
    const skeleton = document.querySelector('.profile-hero-skeleton');
    if (bg && coverUrl) {
      const img = new Image();
      img.onload = () => {
        bg.style.backgroundImage = `url('${coverUrl}')`;
        bg.classList.add('loaded');
        if (skeleton) skeleton.classList.add('hidden');
      };
      img.onerror = () => { if (skeleton) skeleton.classList.add('hidden'); };
      img.src = coverUrl;
    }

    const avatarWrap = document.querySelector('.profile-avatar-wrap');
    const avatar = avatarWrap && avatarWrap.querySelector('.profile-avatar');
    if (avatar) {
      if (avatar.complete && avatar.naturalWidth > 0) {
        avatarWrap.classList.add('loaded');
      } else {
        avatar.addEventListener('load', () => avatarWrap.classList.add('loaded'), { once: true });
        avatar.addEventListener('error', () => avatarWrap.classList.add('loaded'), { once: true });
      }
    }
  }

  let _parallaxCleanup = null;

  function initParallax() {
    if (_parallaxCleanup) { _parallaxCleanup(); _parallaxCleanup = null; }
    const heroBg = document.getElementById('profile-hero-bg') || document.getElementById('home-hero-bg');
    if (!heroBg) return;
    const hero = heroBg.parentElement;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          heroBg.style.transform = `translateY(${-rect.top * 0.35}px) scale(1.1)`;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    _parallaxCleanup = () => window.removeEventListener('scroll', onScroll);
    onScroll();
  }

  // ── Generic Page ──────────────────────────────────────

  async function renderPage(slug) {
    showLoading();
    const page = state.pages.find((p) => p.slug === slug);
    const path = page ? page.path : `content/pages/${slug}.md`;
    try {
      const raw = await loadMarkdown(path);
      const { frontmatter, body } = parseMarkdown(raw);
      const html = renderMd(body);
      document.getElementById('page-content').removeAttribute('data-layout');
      showContent(`<div class="article-body">${html}</div>${contentFooter(frontmatter.author)}`);
      initArticleImages();
      initContentLinks();
      scrollToAnchor();
    } catch { showContent('<div class="empty-state"><h3>Page not found</h3></div>'); }
  }

  // ── Content Footer ──────────────────────────────────────

  function contentFooter(frontmatterAuthor) {
    const author = frontmatterAuthor || (state.config && state.config.author) || '';
    if (!author) return '';
    const year = new Date().getFullYear();
    return `<div class="content-footer">&copy; ${year} ${escapeHtml(author)}</div>`;
  }

  // ── Share ───────────────────────────────────────────────

  function shareButton(title) {
    return `<button class="share-btn" aria-label="Share">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Share</span>
    </button>`;
  }

  function loadImageCors(url) {
    if (_imgCache[url]) return Promise.resolve(_imgCache[url]);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => { img.src = ''; reject(); }, 2000);
      img.onload = () => { clearTimeout(timeout); _imgCache[url] = img; resolve(img); };
      img.onerror = () => { clearTimeout(timeout); reject(); };
      img.src = url;
    });
  }

  function canvasWrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (maxLines && lines.length >= maxLines - 1) { lines.push(line + '\u2026'); line = ''; break; }
        lines.push(line);
        line = word;
      } else { line = test; }
    }
    if (line) lines.push(line);
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lineHeight);
    return lines.length;
  }

  function canvasRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function createLogoImage(color) {
    return new Promise((resolve, reject) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -10 124 120" fill="${color}" stroke="${color}"><path d="M50 8 L8 50 L50 92 L92 50" stroke-width="10" stroke-linejoin="miter" stroke-linecap="butt" fill="none"/><path d="M 50 8 L 68 26" stroke-width="10" stroke-linecap="butt" fill="none"/><rect x="52" y="45" width="40" height="10" stroke="none"/><path d="M 35 22 C 22 8, 6 -2, -8 -4 C -4 4, 10 18, 26 32 Z" stroke="none"/><path d="M 26 68 C 10 84, -4 96, -8 104 C 4 96, 18 82, 35 78 Z" stroke="none"/></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  function canvasFolderIcon(ctx, x, y, size, color) {
    const w = size, h = size * 0.78;
    const tabW = w * 0.38, tabH = h * 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + tabW, y - h);
    ctx.lineTo(x + tabW + tabH, y - h + tabH);
    ctx.lineTo(x + w, y - h + tabH);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  function canvasSeparator(ctx, x1, x2, y) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  async function generateShareImage(title, opts) {
    const { coverUrl, author, readTime, summary, isDirectory, pageCount, pageLabel,
      category, tags, dirPostTitles, isProfile, avatarUrl, role, socials,
      isGallery, galleryImageUrls, galleryCount, isThoughts, isPortfolioDetail } = opts || {};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const S = 1080;
    canvas.width = S;
    canvas.height = S;
    const cs = getComputedStyle(document.documentElement);
    const accent1 = cs.getPropertyValue('--gradient-1').trim() || '#6366f1';
    const accent2 = cs.getPropertyValue('--gradient-2').trim() || '#8b5cf6';

    let coverImg = null, logoImg = null, avatarImg = null;
    const galleryImgs = [];
    const loads = [createLogoImage(accent1).then(i => { logoImg = i; }).catch(() => {})];
    if (coverUrl) loads.push(loadImageCors(coverUrl).then(i => { coverImg = i; }).catch(() => {}));
    if (isProfile && avatarUrl) loads.push(loadImageCors(avatarUrl).then(i => { avatarImg = i; }).catch(() => {}));
    if (isGallery && galleryImageUrls) {
      galleryImageUrls.slice(0, 4).forEach((url, idx) => {
        loads.push(loadImageCors(url).then(img => { galleryImgs[idx] = img; }).catch(() => {}));
      });
    }
    loads.push(Promise.race([document.fonts.load('700 52px "Playfair Display"'), new Promise(r => setTimeout(r, 500))]));
    await Promise.all(loads);

    if (coverImg) {
      const scale = Math.max(S / coverImg.width, S / coverImg.height);
      const w = coverImg.width * scale, h = coverImg.height * scale;
      ctx.filter = 'blur(6px) brightness(0.32)';
      ctx.drawImage(coverImg, (S - w) / 2, (S - h) / 2, w, h);
      ctx.filter = 'none';
    } else {
      const bg = ctx.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, '#0f0f1a'); bg.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 0.18;
      const o1 = ctx.createRadialGradient(S * 0.25, S * 0.2, 0, S * 0.25, S * 0.2, S * 0.4);
      o1.addColorStop(0, accent1); o1.addColorStop(1, 'transparent');
      ctx.fillStyle = o1; ctx.fillRect(0, 0, S, S);
      const o2 = ctx.createRadialGradient(S * 0.82, S * 0.75, 0, S * 0.82, S * 0.75, S * 0.35);
      o2.addColorStop(0, accent1); o2.addColorStop(1, 'transparent');
      ctx.fillStyle = o2; ctx.fillRect(0, 0, S, S);
      ctx.globalAlpha = 1;
    }

    const mg = 56, cardW = S - mg * 2, cardH = S - mg * 2, cardR = 18;
    const barW = 5, pad = 44;
    const footerH = 130, footerTop = mg + cardH - footerH;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 8;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.stroke();

    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    ctx.fillStyle = accent1;
    ctx.fillRect(mg, mg, barW, cardH);
    ctx.restore();

    const useWhiteFooter = !isProfile && !isThoughts && !isGallery && !isDirectory;
    ctx.save();
    canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
    ctx.clip();
    if (useWhiteFooter) {
      ctx.fillStyle = 'rgba(240,240,245,0.92)';
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else if (coverImg) {
      const fs = Math.max(cardW / coverImg.width, footerH * 2 / coverImg.height);
      ctx.filter = 'blur(4px) brightness(0.35)';
      ctx.drawImage(coverImg, mg + (cardW - coverImg.width * fs) / 2, footerTop + (footerH - coverImg.height * fs) / 2, coverImg.width * fs, coverImg.height * fs);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(mg, footerTop, cardW, footerH);
    } else {
      const fg = ctx.createLinearGradient(mg, footerTop, mg + cardW, footerTop + footerH);
      fg.addColorStop(0, '#1a1a2e'); fg.addColorStop(1, '#12122a');
      ctx.fillStyle = fg;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 0.2;
      const fo = ctx.createRadialGradient(mg + cardW * 0.3, footerTop + footerH / 2, 0, mg + cardW * 0.3, footerTop + footerH / 2, 250);
      fo.addColorStop(0, accent1); fo.addColorStop(1, 'transparent');
      ctx.fillStyle = fo;
      ctx.fillRect(mg, footerTop, cardW, footerH);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = useWhiteFooter ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = useWhiteFooter ? 1 : 2.5;
    ctx.beginPath();
    ctx.moveTo(mg + barW, footerTop);
    ctx.lineTo(mg + cardW, footerTop);
    ctx.stroke();
    ctx.restore();

    const cx = mg + barW + pad, cr = mg + cardW - pad;
    const ct = mg + pad, cw = cr - cx;
    const centerX = (cx + cr) / 2;
    const fcx = mg + barW + pad, fcr = mg + cardW - pad;
    const fcy = footerTop + footerH / 2;
    const siteName = (state.config && state.config.hero_title) || 'Raksara';

    if (isProfile) {
      const coverH = cardH - footerH + mg;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      if (coverImg) {
        const cvs = Math.max(cardW / coverImg.width, (coverH) / coverImg.height);
        ctx.filter = 'blur(4px) brightness(0.4)';
        ctx.drawImage(coverImg, mg + (cardW - coverImg.width * cvs) / 2, mg + (coverH - coverImg.height * cvs) / 2, coverImg.width * cvs, coverImg.height * cvs);
        ctx.filter = 'none';
      } else {
        const cvg = ctx.createLinearGradient(mg, mg, mg + cardW, mg + coverH);
        cvg.addColorStop(0, '#1a1a2e'); cvg.addColorStop(1, '#12122a');
        ctx.fillStyle = cvg;
        ctx.fillRect(mg, mg, cardW, coverH);
      }
      ctx.restore();

      const panelTop = mg + 260;
      const panelH = footerTop - panelTop;
      ctx.save();
      canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
      ctx.clip();
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = -4;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      canvasRoundRect(ctx, mg + barW, panelTop, cardW - barW, panelH, 16);
      ctx.stroke();
      ctx.restore();

      const aSize = 200;
      const aCy = panelTop - 10;
      if (avatarImg) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, aCy, aSize / 2, 0, Math.PI * 2);
        ctx.clip();
        const aS = Math.max(aSize / avatarImg.width, aSize / avatarImg.height);
        ctx.drawImage(avatarImg, centerX - avatarImg.width * aS / 2, aCy - avatarImg.height * aS / 2, avatarImg.width * aS, avatarImg.height * aS);
        ctx.restore();
      }

      const nameY = aCy + aSize / 2 + 48;
      ctx.textAlign = 'center';
      ctx.font = '700 42px "Playfair Display", Georgia, serif';
      const nameM = ctx.measureText(title || '');
      const nhPad = 18, nvPad = 10;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      canvasRoundRect(ctx, centerX - nameM.width / 2 - nhPad, nameY - 34 - nvPad, nameM.width + nhPad * 2, 44 + nvPad * 2, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(title || '', centerX, nameY);

      let curProfileY = nameY;

      if (role) {
        curProfileY += 44;
        ctx.font = '500 20px Inter, -apple-system, sans-serif';
        const roleM = ctx.measureText(role);
        const rhPad = 14, rvPad = 7;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        canvasRoundRect(ctx, centerX - roleM.width / 2 - rhPad, curProfileY - 16 - rvPad, roleM.width + rhPad * 2, 24 + rvPad * 2, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(role, centerX, curProfileY);
      }

      curProfileY += 38;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 60, curProfileY);
      ctx.lineTo(cr - 60, curProfileY);
      ctx.stroke();

      const metadata = opts.metadata;
      if (metadata && metadata.length) {
        curProfileY += 24;
        ctx.textAlign = 'left';
        const chipX = cx + 20;
        const chipMaxW = cw - 40;
        const cPadH = 20, cPadV = 11, cH = 22 + cPadV * 2, cR = cH / 2;
        for (const item of metadata.slice(0, 3)) {
          ctx.font = '700 17px Inter, -apple-system, sans-serif';
          const lblW = ctx.measureText(item.label).width;
          let fullW = lblW;
          let sepW = 0, valText = item.value || '';
          if (valText) {
            ctx.font = '400 17px Inter, -apple-system, sans-serif';
            sepW = ctx.measureText('  :  ').width;
            ctx.font = '500 17px Inter, -apple-system, sans-serif';
            fullW = lblW + sepW + ctx.measureText(valText).width;
            const maxInner = chipMaxW - cPadH * 2;
            if (fullW > maxInner) {
              const valMaxW = maxInner - lblW - sepW;
              while (ctx.measureText(valText).width > valMaxW && valText.length > 1) valText = valText.slice(0, -1);
              if (valText.length < item.value.length) valText += '\u2026';
            }
            fullW = lblW + sepW + ctx.measureText(valText).width;
          }
          const chipW = Math.min(fullW + cPadH * 2, chipMaxW);

          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.12)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = 'rgba(40,40,50,0.75)';
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curProfileY, chipW, cH, cR);
          ctx.stroke();

          const tY = curProfileY + cH / 2 + 6;
          ctx.font = '700 17px Inter, -apple-system, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.fillText(item.label, chipX + cPadH, tY);
          if (item.value) {
            const lW = ctx.measureText(item.label).width;
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = '400 17px Inter, -apple-system, sans-serif';
            ctx.fillText('  :  ', chipX + cPadH + lW, tY);
            const sW = ctx.measureText('  :  ').width;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '500 17px Inter, -apple-system, sans-serif';
            ctx.fillText(valText, chipX + cPadH + lW + sW, tY);
          }
          curProfileY += cH + 10;
        }
      }
      ctx.textAlign = 'left';

      if (logoImg) {
        const lh = 28, lw = lh * (logoImg.width / logoImg.height);
        ctx.font = '600 20px Inter, -apple-system, sans-serif';
        const snw = ctx.measureText(siteName).width;
        const totalW = lw + 10 + snw;
        const lx = centerX - totalW / 2;
        ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(siteName, lx + lw + 10, fcy + 8);
      }
    } else {
      const hasCover = !!coverImg;
      const coverH = hasCover ? Math.floor(cardH * 0.25) : 0;
      if (hasCover) {
        ctx.save();
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        const cvs = Math.max(cardW / coverImg.width, coverH / coverImg.height);
        ctx.filter = 'blur(3px)';
        ctx.drawImage(coverImg, mg + (cardW - coverImg.width * cvs) / 2, mg + (coverH - coverImg.height * cvs) / 2, coverImg.width * cvs, coverImg.height * cvs);
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(mg, mg, cardW, coverH);
        ctx.restore();
      }

      const contentTop = mg + coverH + 28;
      let curY = contentTop;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '700 56px "Playfair Display", Georgia, serif';
      const rawTitleLines = [];
      { const words = (title || '').split(' '); let line = '';
        for (const word of words) {
          const test = line + (line ? ' ' : '') + word;
          if (ctx.measureText(test).width > cw - 30 && line) {
            if (rawTitleLines.length >= 2) { rawTitleLines.push(line + '\u2026'); line = ''; break; }
            rawTitleLines.push(line); line = word;
          } else line = test;
        }
        if (line) rawTitleLines.push(rawTitleLines.length >= 3 ? line.slice(0, -1) + '\u2026' : line);
      }
      const tLh = 70;
      for (let i = 0; i < rawTitleLines.length; i++) {
        const tw = ctx.measureText(rawTitleLines[i]).width;
        const hlPad = 10;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        canvasRoundRect(ctx, cx - hlPad, curY - 6 + i * tLh, tw + hlPad * 2, tLh - 6, 6);
        ctx.fill();
      }
      ctx.fillStyle = '#111';
      ctx.font = '700 56px "Playfair Display", Georgia, serif';
      for (let i = 0; i < rawTitleLines.length; i++) ctx.fillText(rawTitleLines[i], cx, curY + 48 + i * tLh);
      curY += rawTitleLines.length * tLh + 10;

      if (summary) {
        curY += 8;
        ctx.fillStyle = '#555';
        ctx.font = '400 24px Inter, -apple-system, sans-serif';
        const sumLines = canvasWrapText(ctx, summary, cx, curY, cw, 34, 3);
        curY += sumLines * 34;
      }

      const chipLabels = [];
      if (category) chipLabels.push(category);
      if (tags && tags.length) {
        for (const t of tags) { if (t !== category && chipLabels.length < 4) chipLabels.push(t); }
      }
      if (chipLabels.length) {
        curY += 18;
        let chipX = cx;
        ctx.font = '600 16px Inter, -apple-system, sans-serif';
        for (const label of chipLabels) {
          const tw = ctx.measureText(label).width;
          const cW = tw + 28, cH = 36, cR = 8;
          if (chipX + cW > cr) break;
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, chipX, curY, cW, cH, cR);
          ctx.stroke();
          ctx.fillStyle = accent1;
          ctx.fillText(label, chipX + 14, curY + 24);
          chipX += cW + 10;
        }
        curY += 36;
      }

      if (readTime && !isPortfolioDetail) {
        curY += 12;
        ctx.fillStyle = '#999';
        ctx.font = '500 16px Inter, -apple-system, sans-serif';
        ctx.fillText(readTime + ' min read', cx, curY + 14);
        curY += 24;
      }

      if (author) {
        const aPadH = 16, aPadV = 10, aFh = 18;
        ctx.font = '600 ' + aFh + 'px Inter, -apple-system, sans-serif';
        const aText = 'by  ' + author;
        const aTw = ctx.measureText(aText).width;
        const aW = aTw + aPadH * 2, aH = aFh + aPadV * 2, aR = aH / 2;
        const aX = fcx, aY = fcy - aH / 2;
        ctx.fillStyle = 'rgba(40,40,50,0.82)';
        canvasRoundRect(ctx, aX, aY, aW, aH, aR);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(aText, aX + aPadH, aY + aPadV + aFh - 3);
      }

      if (logoImg) {
        const lh = 22, lw = lh * (logoImg.width / logoImg.height);
        ctx.font = '600 16px Inter, -apple-system, sans-serif';
        const snw = ctx.measureText(siteName).width;
        const chipW = lw + 10 + snw + 28, chipH = 38, chipR = chipH / 2;
        const chipX = fcr - chipW, chipY = fcy - chipH / 2;
        ctx.fillStyle = 'rgba(40,40,50,0.82)';
        canvasRoundRect(ctx, chipX, chipY, chipW, chipH, chipR);
        ctx.fill();
        ctx.drawImage(logoImg, chipX + 14, chipY + (chipH - lh) / 2, lw, lh);
        ctx.fillStyle = '#fff';
        ctx.fillText(siteName, chipX + 14 + lw + 8, fcy + 6);
      }

      if (isPortfolioDetail) {
        const availH = footerTop - curY - 20;
        const gCx = centerX, gCy = curY + availH * 0.45;
        const gR = 80;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 6;
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(gCx, gCy, gR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        const teeth = 8, toothH = 16, toothW = 22;
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let t = 0; t < teeth; t++) {
          const angle = (Math.PI * 2 / teeth) * t;
          ctx.save();
          ctx.translate(gCx, gCy);
          ctx.rotate(angle);
          canvasRoundRect(ctx, -toothW / 2, -(gR + toothH), toothW, toothH + 6, 5);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath(); ctx.arc(gCx, gCy, gR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath(); ctx.arc(gCx, gCy, gR * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gCx, gCy, gR * 0.45, 0, Math.PI * 2); ctx.stroke();

        const smR = 32, smOff = gR + 50;
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.beginPath(); ctx.arc(gCx + smOff, gCy - 20, smR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gCx + smOff, gCy - 20, smR, 0, Math.PI * 2); ctx.stroke();
        const smTeeth = 6, smTH = 10, smTW = 14;
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        for (let t = 0; t < smTeeth; t++) {
          const angle = (Math.PI * 2 / smTeeth) * t + 0.3;
          ctx.save();
          ctx.translate(gCx + smOff, gCy - 20);
          ctx.rotate(angle);
          canvasRoundRect(ctx, -smTW / 2, -(smR + smTH), smTW, smTH + 4, 4);
          ctx.fill();
          ctx.restore();
        }
      } else if (isThoughts) {
        const availH = footerTop - curY - 40;
        const bCx = centerX, bCy = curY + 16 + availH * 0.4;
        const bW = 380, bH = 260, bR = 32;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.10)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.10)';
        ctx.lineWidth = 2;
        canvasRoundRect(ctx, bCx - bW / 2, bCy - bH / 2, bW, bH, bR);
        ctx.stroke();
        const dotY = bCy + bH / 2 + 24;
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.beginPath(); ctx.arc(bCx - 24, dotY, 18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bCx - 58, dotY + 30, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        for (let i = 0; i < 4; i++) {
          const lw = bW * (0.75 - i * 0.12);
          canvasRoundRect(ctx, bCx - lw / 2, bCy - bH / 2 + 48 + i * 36, lw, 14, 7);
          ctx.fill();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = '#777';
        ctx.font = '500 24px Inter, -apple-system, sans-serif';
        ctx.fillText('Random ideas that pop in my mind', bCx, bCy + bH / 2 + 80);
        ctx.textAlign = 'left';
        if (logoImg) {
          const lh = 28, lw = lh * (logoImg.width / logoImg.height);
          ctx.font = '600 20px Inter, -apple-system, sans-serif';
          const snw = ctx.measureText(siteName).width;
          const totalW = lw + 10 + snw;
          const lx = centerX - totalW / 2;
          ctx.drawImage(logoImg, lx, fcy - lh / 2 + 2, lw, lh);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(siteName, lx + lw + 10, fcy + 8);
        }
      } else if (isGallery) {
        const imgs = galleryImgs.filter(Boolean);
        const gridCount = Math.min(imgs.length, 4);
        if (gridCount) {
          const mGap = 14, mR = 10;
          const gridAvailH = footerTop - curY - 10;
          const mH = Math.floor((gridAvailH - mGap) / 2);
          const mW = mH;
          const gridTotalW = mW * 2 + mGap;
          const gridStartX = cx + (cw - gridTotalW) / 2;
          const mStartY = curY + 10;
          ctx.save();
          ctx.beginPath();
          ctx.rect(mg, mg, cardW, footerTop - mg);
          canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
          ctx.clip();
          for (let i = 0; i < 4; i++) {
            const col = i % 2, row = Math.floor(i / 2);
            const mx = gridStartX + col * (mW + mGap);
            const my = mStartY + row * (mH + mGap);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.10)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.stroke();
            if (i < gridCount) {
              ctx.save();
              canvasRoundRect(ctx, mx, my, mW, mH, mR);
              ctx.clip();
              const img = imgs[i];
              const iScale = Math.max(mW / img.width, mH / img.height);
              ctx.drawImage(img, mx + (mW - img.width * iScale) / 2, my + (mH - img.height * iScale) / 2, img.width * iScale, img.height * iScale);
              ctx.restore();
            }
          }
          ctx.restore();
        }
        const gCount = galleryCount || 0;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 28px Inter, -apple-system, sans-serif';
        ctx.fillText(gCount + ' photo' + (gCount !== 1 ? 's' : ''), fcx, fcy + 11);
      } else if (isDirectory) {
        canvasSeparator(ctx, cx, cr, curY + 8);
        const titles = dirPostTitles || [];
        const mGap = 14, mR = 10;
        const gridAvailH = footerTop - curY - 24;
        const mH = Math.floor((gridAvailH - mGap) / 2);
        const mW = mH;
        const gridTotalW = mW * 2 + mGap;
        const gridStartX = cx + (cw - gridTotalW) / 2;
        const mStartY = curY + 24;
        ctx.save();
        ctx.beginPath();
        ctx.rect(mg, mg, cardW, footerTop - mg);
        canvasRoundRect(ctx, mg, mg, cardW, cardH, cardR);
        ctx.clip();
        for (let i = 0; i < 4; i++) {
          const col = i % 2, row = Math.floor(i / 2);
          const mx = gridStartX + col * (mW + mGap);
          const my = mStartY + row * (mH + mGap);
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.08)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, mx, my, mW, mH, mR);
          ctx.stroke();
          if (i < titles.length) {
            ctx.save();
            canvasRoundRect(ctx, mx, my, mW, mH, mR);
            ctx.clip();
            ctx.fillStyle = accent1;
            ctx.fillRect(mx, my, mW, 5);
            ctx.restore();
            ctx.fillStyle = '#333';
            ctx.font = 'bold 18px Inter, -apple-system, sans-serif';
            canvasWrapText(ctx, titles[i] || '', mx + 14, my + 30, mW - 28, 24, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.07)';
            for (let l = 0; l < 3; l++) {
              canvasRoundRect(ctx, mx + 14, my + 82 + l * 18, mW * (0.65 - l * 0.1), 8, 4);
              ctx.fill();
            }
          }
        }
        ctx.restore();
        const label = pageLabel || 'post';
        canvasFolderIcon(ctx, fcx, fcy + 14, 38, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Inter, -apple-system, sans-serif';
        ctx.fillText(pageCount + ' ' + label + (pageCount !== 1 ? 's' : ''), fcx + 52, fcy + 11);
      }
    }

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  const _imgCache = {};
  function prefetchImage(url) {
    if (!url || _imgCache[url]) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { _imgCache[url] = img; };
    img.src = url;
  }

  function initShareButton(title, opts) {
    const btn = document.querySelector('.share-btn');
    if (!btn) return;
    if (opts && opts.coverUrl) prefetchImage(opts.coverUrl);
    btn.addEventListener('click', async () => {
      const url = window.location.href;
      const label = btn.querySelector('span');
      const origText = label ? label.textContent : '';
      if (label) label.textContent = 'Generating...';
      try {
      if (navigator.share) {
        const shareData = { title, text: title, url };
        try {
          const testFile = new File([''], 't.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
            const resolvedAuthor = (opts && opts.author) || (state.config && state.config.author) || '';
            const blob = await generateShareImage(title, { ...opts, author: resolvedAuthor });
            if (blob) shareData.files = [new File([blob], 'share.png', { type: 'image/png' })];
          }
        } catch {}
        if (label) label.textContent = origText;
        try { await navigator.share(shareData); } catch {}
        return;
      }
      try {
        const resolvedAuthor = (opts && opts.author) || (state.config && state.config.author) || '';
        const blob = await generateShareImage(title, { ...opts, author: resolvedAuthor });
        const items = [new ClipboardItem({ 'text/plain': new Blob([title ? `${title} : ${url}` : url], { type: 'text/plain' }), ...(blob ? { 'image/png': blob } : {}) })];
        await navigator.clipboard.write(items);
        if (label) label.textContent = 'Copied!';
        setTimeout(() => { if (label) label.textContent = origText; }, 2000);
      } catch {
        try {
          await navigator.clipboard.writeText(title ? `${title} : ${url}` : url);
          if (label) label.textContent = 'Copied!';
          setTimeout(() => { if (label) label.textContent = origText; }, 2000);
        } catch {}
      }
      } finally {
        if (label && label.textContent === 'Generating...') label.textContent = origText;
      }
    });
  }

  // ── Image Lightbox in Articles ────────────────────────

  function initCodeBlocks() {
    document.querySelectorAll('.article-body pre').forEach((pre) => {
      if (pre.parentElement.classList.contains('code-block-wrap')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrap';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.title = 'Copy code';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.3"/></svg>';
          }, 2000);
        });
      });
      wrapper.appendChild(btn);
    });
  }

  function initVideoPlayers() {
    document.querySelectorAll('.article-body a.video-player').forEach(a => {
      const href = a.getAttribute('href') || '';
      const img = a.querySelector('img');
      const title = img ? (img.alt || '') : (a.getAttribute('data-title') || '');
      const src = img ? img.src : '';
      const thumbSrc = src || a.getAttribute('data-thumbnail') || '';
      if (!thumbSrc) return;
      const player = document.createElement('div');
      player.className = 'video-player';
      player.addEventListener('click', () => window.open(href, '_blank'));
      player.innerHTML = `
        <img src="${thumbSrc}" alt="${escapeHtml(title)}" loading="lazy">
        <div class="video-player-overlay">
          <div class="video-player-play">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
          ${title ? `<div class="video-player-title">${escapeHtml(title)}</div>` : ''}
        </div>`;
      a.replaceWith(player);
    });
  }

  function initArticleImages() {
    document.querySelectorAll('.article-body pre code').forEach((el) => hljs.highlightElement(el));
    initCodeBlocks();
    initVideoPlayers();
    document.querySelectorAll('.article-body img').forEach((img) => {
      if (img.closest('.video-player')) return;
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
    initLazyImages();
  }

  let _carouselImages = [];
  let _carouselIndex = 0;

  function openLightbox(src, caption) {
    _carouselImages = [];
    _carouselIndex = 0;
    const lb = document.getElementById('lightbox');
    const content = lb.querySelector('.lightbox-content');
    content.querySelectorAll('.lightbox-nav, .lightbox-dots').forEach(el => el.remove());
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-caption').textContent = caption || '';
    lb.classList.remove('hidden');
  }

  function openCarousel(images, startIndex) {
    _carouselImages = images;
    _carouselIndex = startIndex || 0;
    const lb = document.getElementById('lightbox');
    const content = lb.querySelector('.lightbox-content');
    content.querySelectorAll('.lightbox-nav, .lightbox-dots').forEach(el => el.remove());
    const current = images[_carouselIndex];
    document.getElementById('lightbox-img').src = resolvePath(current.src);
    document.getElementById('lightbox-caption').textContent = current.caption || '';
    if (images.length > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'lightbox-nav prev';
      prevBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateCarousel(-1); });
      const nextBtn = document.createElement('button');
      nextBtn.className = 'lightbox-nav next';
      nextBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateCarousel(1); });
      content.appendChild(prevBtn);
      content.appendChild(nextBtn);
      const dots = document.createElement('div');
      dots.className = 'lightbox-dots';
      images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'lightbox-dot' + (i === _carouselIndex ? ' active' : '');
        dot.addEventListener('click', (e) => { e.stopPropagation(); goToCarouselSlide(i); });
        dots.appendChild(dot);
      });
      content.appendChild(dots);
    }
    lb.classList.remove('hidden');
  }

  function navigateCarousel(dir) {
    if (_carouselImages.length < 2) return;
    _carouselIndex = (_carouselIndex + dir + _carouselImages.length) % _carouselImages.length;
    updateCarouselSlide();
  }

  function goToCarouselSlide(index) {
    _carouselIndex = index;
    updateCarouselSlide();
  }

  function updateCarouselSlide() {
    const current = _carouselImages[_carouselIndex];
    const img = document.getElementById('lightbox-img');
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = resolvePath(current.src);
      document.getElementById('lightbox-caption').textContent = current.caption || '';
      img.style.opacity = '1';
    }, 150);
    document.querySelectorAll('.lightbox-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === _carouselIndex);
    });
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
    _carouselImages = [];
    _carouselIndex = 0;
    lb.querySelector('.lightbox-content').querySelectorAll('.lightbox-nav, .lightbox-dots').forEach(el => el.remove());
  }

  window.__openLightbox = openLightbox;

  window.__openGallery = function(galleryIndex) {
    const g = state.gallery[galleryIndex];
    if (!g) return;
    const images = getGalleryImages(g);
    if (!images.length) return;
    if (images.length === 1) {
      openLightbox(resolvePath(images[0].src), images[0].caption || g.caption);
    } else {
      openCarousel(images, 0);
    }
  };

  // ── Router ────────────────────────────────────────────

  async function handleRoute() {
    if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null; }
    document.body.classList.remove('reading-mode');
    document.body.style.overflow = '';
    showLoading();
    await loadData();
    if (!state.loaded) return;

    const hash = window.location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);
    updateActiveNav(hash);

    if (hash === '/' || hash === '') renderHome();
    else if (parts[0] === 'blog' && parts[1] === 'post' && parts.length > 2) await renderBlogPost(parts.slice(2).join('/'));
    else if (parts[0] === 'blog' && parts[1] === 'dir' && parts.length > 2) renderBlogDir(parts.slice(2).join('/'));
    else if (parts[0] === 'blog') renderBlogDir('');
    else if (parts[0] === 'portfolio' && parts[1]) await renderPortfolioItem(parts[1]);
    else if (parts[0] === 'portfolio') renderPortfolioList();
    else if (parts[0] === 'gallery' && parts[1]) renderGallery(parseInt(parts[1]));
    else if (parts[0] === 'gallery') renderGallery();
    else if (parts[0] === 'thoughts') renderThoughts();
    else if (parts[0] === 'tags') renderTags();
    else if (parts[0] === 'tag' && parts[1]) renderTagPosts(decodeURIComponent(parts[1]));
    else if (parts[0] === 'categories') renderCategories();
    else if (parts[0] === 'category' && parts[1]) renderCategoryPosts(decodeURIComponent(parts[1]));
    else if (parts[0] === 'profile') await renderProfile();
    else if (parts[0] === 'about') await renderPage('about');
    else await renderPage(parts[0]);
  }

  function updateActiveNav(route) {
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.remove('active');
      const lr = link.getAttribute('data-route');
      if (!lr) return;
      if (lr === 'home' && (route === '/' || route === '')) link.classList.add('active');
      else if (lr !== 'home' && route.startsWith('/' + lr)) link.classList.add('active');
    });
  }

  // ── Search Overlay ────────────────────────────────────

  function initSearch() {
    const trigger = document.getElementById('search-trigger');
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-overlay-input');
    const results = document.getElementById('search-overlay-results');
    const backdrop = overlay.querySelector('.search-overlay-backdrop');
    let debounceTimer;

    const searchPhrases = ['Search posts...', 'Search projects...', 'Search thoughts...', 'Search tags...'];
    let phraseIdx = 0, phraseCharIdx = 0, phraseDir = 1, phraseTimer = null;

    function animatePlaceholder() {
      if (overlay.classList.contains('hidden') || input.value.length > 0) return;
      const phrase = searchPhrases[phraseIdx];
      if (phraseDir === 1) {
        phraseCharIdx++;
        if (phraseCharIdx > phrase.length) { phraseDir = -1; phraseTimer = setTimeout(animatePlaceholder, 2000); return; }
      } else {
        phraseCharIdx--;
        if (phraseCharIdx < 0) { phraseDir = 1; phraseIdx = (phraseIdx + 1) % searchPhrases.length; phraseCharIdx = 0; phraseTimer = setTimeout(animatePlaceholder, 400); return; }
      }
      input.setAttribute('placeholder', phrase.slice(0, phraseCharIdx));
      phraseTimer = setTimeout(animatePlaceholder, phraseDir === 1 ? 80 : 40);
    }

    function openSearch() {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input.focus(), 50);
      phraseIdx = 0; phraseCharIdx = 0; phraseDir = 1;
      if (phraseTimer) clearTimeout(phraseTimer);
      animatePlaceholder();
    }

    function closeSearch() {
      overlay.classList.add('hidden');
      document.body.style.overflow = '';
      input.value = '';
      input.setAttribute('placeholder', 'Search posts, projects, thoughts...');
      results.innerHTML = '';
      if (phraseTimer) { clearTimeout(phraseTimer); phraseTimer = null; }
    }

    trigger.addEventListener('click', openSearch);
    backdrop.addEventListener('click', closeSearch);

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') closeSearch();
    });

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      if (!input.value && !overlay.classList.contains('hidden')) {
        if (phraseTimer) clearTimeout(phraseTimer);
        phraseCharIdx = 0; phraseDir = 1;
        animatePlaceholder();
      }
      debounceTimer = setTimeout(() => {
        const query = input.value.trim();
        if (query.length < 2 || !state.miniSearch) {
          results.innerHTML = '';
          return;
        }
        const hits = state.miniSearch.search(query, { limit: 10 });
        if (!hits.length) {
          results.innerHTML = '<div class="search-empty">No results found</div>';
          return;
        }
        results.innerHTML = hits.map((h) => {
          let href = '#/';
          if (h.section === 'blog') href = `#/blog/post/${h.slug}`;
          else if (h.section === 'portfolio') href = `#/portfolio/${h.slug}`;
          else if (h.section === 'gallery') href = `#/gallery`;
          else if (h.section === 'thoughts') href = `#/thoughts`;
          else if (h.section === 'pages') href = `#/${h.slug}`;
          return `<div class="search-result-item" data-href="${href}">
            <div class="search-result-title">${escapeHtml(h.title)}</div>
            <div class="search-result-meta">${escapeHtml(h.section)}${h.category ? ' \u00B7 ' + escapeHtml(h.category) : ''}</div>
          </div>`;
        }).join('');
        results.querySelectorAll('.search-result-item').forEach((item) => {
          item.addEventListener('click', () => {
            window.location.hash = item.dataset.href;
            closeSearch();
          });
        });
      }, 150);
    });
  }

  // ── Theme Toggle ──────────────────────────────────────

  const COLOR_PALETTES = {
    purple: { accent: '#6366f1', hoverDark: '#818cf8', hoverLight: '#4f46e5', g1: '#6366f1', g2: '#8b5cf6', g3: '#a855f7', rgb: '99,102,241' },
    blue:   { accent: '#3b82f6', hoverDark: '#60a5fa', hoverLight: '#2563eb', g1: '#3b82f6', g2: '#06b6d4', g3: '#0ea5e9', rgb: '59,130,246' },
    red:    { accent: '#ef4444', hoverDark: '#f87171', hoverLight: '#dc2626', g1: '#ef4444', g2: '#f43f5e', g3: '#ec4899', rgb: '239,68,68' },
    yellow: { accent: '#eab308', hoverDark: '#facc15', hoverLight: '#ca8a04', g1: '#eab308', g2: '#f59e0b', g3: '#f97316', rgb: '234,179,8' },
    green:  { accent: '#22c55e', hoverDark: '#4ade80', hoverLight: '#16a34a', g1: '#22c55e', g2: '#10b981', g3: '#14b8a6', rgb: '34,197,94' },
    orange: { accent: '#f97316', hoverDark: '#fb923c', hoverLight: '#ea580c', g1: '#f97316', g2: '#fb923c', g3: '#fbbf24', rgb: '249,115,22' },
  };

  function applyAccentColor(colorName) {
    const c = COLOR_PALETTES[(colorName || '').toLowerCase()] || COLOR_PALETTES.purple;
    const s = document.documentElement.style;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    s.setProperty('--accent', c.accent);
    s.setProperty('--accent-hover', isDark ? c.hoverDark : c.hoverLight);
    s.setProperty('--accent-subtle', `rgba(${c.rgb},${isDark ? 0.12 : 0.08})`);
    s.setProperty('--accent-border', `rgba(${c.rgb},${isDark ? 0.3 : 0.2})`);
    s.setProperty('--accent-glow', `rgba(${c.rgb},${isDark ? 0.15 : 0.1})`);
    s.setProperty('--gradient-1', c.g1);
    s.setProperty('--gradient-2', c.g2);
    s.setProperty('--gradient-3', c.g3);
    s.setProperty('--gradient-4', c.g1);

    if (isDark) {
      s.setProperty('--bg-hover', 'rgba(255,255,255,0.06)');
      s.setProperty('--bg-active', 'rgba(255,255,255,0.08)');
    } else {
      s.setProperty('--bg-hover', `rgba(${c.rgb},0.06)`);
      s.setProperty('--bg-active', `rgba(${c.rgb},0.08)`);
    }

    s.setProperty('--gradient-bg',
      `radial-gradient(ellipse 80% 60% at 20% 0%, rgba(${c.rgb},${isDark ? 0.12 : 0.08}) 0%, transparent 50%),` +
      `radial-gradient(ellipse 60% 50% at 80% 100%, rgba(${c.rgb},${isDark ? 0.08 : 0.06}) 0%, transparent 50%),` +
      `radial-gradient(ellipse 50% 40% at 50% 50%, rgba(${c.rgb},${isDark ? 0.05 : 0.03}) 0%, transparent 50%)`
    );
  }

  async function applyLogo(logoPath) {
    try {
      const res = await fetch(logoPath);
      if (!res.ok) return;
      const svgText = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = svgText.trim();
      const svg = tmp.querySelector('svg');
      if (!svg) return;
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.style.display = 'block';
      document.querySelectorAll('.logo-icon').forEach(el => {
        el.textContent = '';
        el.appendChild(svg.cloneNode(true));
      });
      const faviconSvg = svg.cloneNode(true);
      faviconSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const blob = new Blob([faviconSvg.outerHTML], { type: 'image/svg+xml' });
      const faviconUrl = URL.createObjectURL(blob);
      let link = document.querySelector('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.type = 'image/svg+xml';
      link.href = faviconUrl;
    } catch { /* logo not available, keep fallback */ }
  }

  function syncThemeIcons(theme) {
    const containers = [
      document.getElementById('theme-toggle'),
      document.querySelector('.mobile-theme-toggle'),
    ];
    for (const c of containers) {
      if (!c) continue;
      const sun = c.querySelector('.icon-sun');
      const moon = c.querySelector('.icon-moon');
      if (sun) sun.style.display = theme === 'light' ? 'block' : 'none';
      if (moon) moon.style.display = theme === 'dark' ? 'block' : 'none';
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('raksara-theme', theme);
    syncThemeIcons(theme);
    applyAccentColor((state.config && state.config.color) || 'purple');
    const hljsDark = document.getElementById('hljs-dark');
    const hljsLight = document.getElementById('hljs-light');
    if (hljsDark) hljsDark.disabled = theme === 'light';
    if (hljsLight) hljsLight.disabled = theme === 'dark';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    const saved = localStorage.getItem('raksara-theme');
    const theme = saved || document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(theme);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  }

  // ── Lightbox Events ───────────────────────────────────

  function initLightbox() {
    const lb = document.getElementById('lightbox');
    lb.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
    lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
      if (lb.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft' && _carouselImages.length > 1) navigateCarousel(-1);
      if (e.key === 'ArrowRight' && _carouselImages.length > 1) navigateCarousel(1);
    });
  }

  // ── Mobile Sidebar ────────────────────────────────────

  function initMobileSidebar() {
    const header = document.createElement('div');
    header.className = 'mobile-header';
    header.innerHTML = `
      <button class="mobile-menu-btn" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <a href="#/" class="logo"><span class="logo-icon">\u25C6</span><span class="logo-text">Raksara</span></a>
      <button class="icon-btn mobile-theme-toggle" aria-label="Toggle theme">
        <svg class="icon-sun" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        <svg class="icon-moon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    `;
    document.body.prepend(header);

    header.querySelector('.mobile-theme-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTheme();
    });
    syncThemeIcons(document.documentElement.getAttribute('data-theme') || 'dark');

    const sidebar = document.getElementById('sidebar');
    header.querySelector('.mobile-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.getElementById('content').addEventListener('click', () => sidebar.classList.remove('open'));

    sidebar.querySelectorAll('a, button:not(#theme-toggle)').forEach(el => {
      el.addEventListener('click', () => sidebar.classList.remove('open'));
    });
  }

  // ── Init ──────────────────────────────────────────────

  function init() {
    window.addEventListener('hashchange', handleRoute);
    initTheme();
    initSearch();
    initLightbox();
    initMobileSidebar();
    handleRoute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
