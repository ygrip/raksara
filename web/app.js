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

  function renderMd(md) {
    const renderer = new marked.Renderer();
    const defaultImage = renderer.image.bind(renderer);
    renderer.image = function (href, title, text) {
      const resolved = resolvePath(typeof href === 'object' ? href.href : href);
      return `<img src="${resolved}" alt="${text || ''}"${title ? ` title="${title}"` : ''} loading="lazy">`;
    };
    marked.setOptions({
      renderer,
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
        return hljs.highlightAuto(code).value;
      },
      breaks: false,
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

  function renderHome() {
    const recentPosts = state.posts.slice(0, 3);
    const recentThoughts = state.thoughts.slice(0, 2);

    let postsHtml = recentPosts.map(renderPostCard).join('');

    let portfolioHtml = state.portfolio.slice(0, 4).map((p) => renderPortfolioCard(p)).join('');

    let thoughtsHtml = recentThoughts.map((t) => renderThoughtCard(t)).join('');

    let galleryHtml = state.gallery.slice(0, 4).map((g) => {
      const imgSrc = resolvePath(g.image);
      return `
      <div class="gallery-item" onclick="window.__openLightbox('${escapeHtml(imgSrc)}','${escapeHtml(g.caption)}')">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(g.title)}" loading="lazy">
        <div class="gallery-item-overlay">
          <div class="gallery-item-title">${escapeHtml(g.title)}</div>
        </div>
      </div>`;
    }).join('');

    const heroTitle = (state.config && state.config.hero_title) || 'Raksara';
    const heroSubtitle = (state.config && state.config.hero_subtitle) || 'A place where ideas, knowledge, and engineering thoughts are recorded.';

    const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,25 C240,50 480,0 720,25 C960,50 1200,0 1440,25 L1440,60 L0,60 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,30 C120,10 240,50 360,30 C480,10 600,50 720,30 C840,10 960,50 1080,30 C1200,10 1320,50 1440,30 L1440,60 L0,60 Z"/></svg></div>`;

    showContent(`
      <div class="home-hero" id="profile-hero">
        <div class="home-hero-aurora" id="home-hero-bg"></div>
        <div class="home-hero-content">
          <h1 class="home-hero-title">
            <span class="accent-gradient">${escapeHtml(heroTitle)}</span>
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
    return `
      <a href="#/blog/post/${p.slug}" class="post-card">
        <div class="post-card-title">${escapeHtml(p.title)}</div>
        <div class="post-card-summary">${escapeHtml(p.summary || '')}</div>
        <div class="post-card-meta">
          <span class="post-card-date">${formatDate(p.date)}</span>
          ${p.category ? `<span class="post-card-category">${escapeHtml(p.category)}</span>` : ''}
          ${(p.tags || []).map((t) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(t)}</span>`).join('')}
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
    initShareButton(title);
  }

  async function renderBlogPost(slug) {
    showLoading();
    const post = state.posts.find((p) => p.slug === slug);
    if (!post) { showContent('<div class="empty-state"><h3>Post not found</h3></div>'); return; }
    try {
      const raw = await loadMarkdown(post.path);
      const { frontmatter, body } = parseMarkdown(raw);
      const html = renderMd(body);
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

      showContent(`
        ${breadcrumbsHtml}
        <div class="article-top-bar">
          <a href="${backHref}" class="back-link">\u2190 Back to ${escapeHtml(backLabel)}</a>
          ${shareButton(post.title)}
        </div>
        <div class="article-header">
          <h1>${escapeHtml(post.title)}</h1>
          <div class="article-meta">
            <span class="post-card-date">${formatDate(post.date)}</span>
            ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ''}
            ${tagsHtml}
          </div>
        </div>
        <div class="article-body">${html}</div>
        ${postNavHtml}
      `);
      initShareButton(post.title);
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Failed to load post</h3></div>'); }
  }

  // ── Portfolio ─────────────────────────────────────────

  function renderPortfolioCard(p) {
    const tagsHtml = (p.tags || []).map((t) => `<span class="tag" style="padding:3px 10px;font-size:11px">${escapeHtml(t)}</span>`).join('');
    const links = [];
    if (p.github) links.push(`<a href="${escapeHtml(p.github)}" class="btn-github" target="_blank" rel="noopener">GitHub</a>`);
    if (p.demo) links.push(`<a href="${escapeHtml(p.demo)}" class="btn-demo" target="_blank" rel="noopener">Demo</a>`);
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
    initShareButton('Portfolio');
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
      const { body } = parseMarkdown(raw);
      const html = renderMd(body);
      const tagsHtml = (item.tags || []).map((t) => `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');
      const links = [];
      if (item.github) links.push(`<a href="${escapeHtml(item.github)}" class="btn-github" target="_blank" rel="noopener">GitHub</a>`);
      if (item.demo) links.push(`<a href="${escapeHtml(item.demo)}" class="btn-demo" target="_blank" rel="noopener">Demo</a>`);
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
            ${links.length ? `<div style="margin-left:auto;display:flex;gap:8px">${links.join('')}</div>` : ''}
          </div>
        </div>
        <div class="article-body">${html}</div>
      `);
      initShareButton(item.title);
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Failed to load project</h3></div>'); }
  }

  // ── Gallery ───────────────────────────────────────────

  function renderGallery() {
    const items = state.gallery.map((g) => {
      const imgSrc = resolvePath(g.image);
      const desc = g.description || '';
      const hasLongDesc = desc.length > 120;
      return `
      <div class="gallery-card">
        <div class="gallery-card-img" onclick="window.__openLightbox('${escapeHtml(imgSrc)}','${escapeHtml(g.caption)}')">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(g.title)}" loading="lazy">
        </div>
        <div class="gallery-card-info">
          <div class="gallery-card-header">
            <div class="gallery-card-title">${escapeHtml(g.title)}</div>
            <div class="gallery-card-date">${formatDate(g.date)}</div>
          </div>
          ${g.caption ? `<div class="gallery-card-caption">${escapeHtml(g.caption)}</div>` : ''}
          ${desc ? `<div class="gallery-card-desc${hasLongDesc ? ' collapsed' : ''}">
            <div class="gallery-card-desc-text">${escapeHtml(desc)}</div>
            ${hasLongDesc ? '<button class="gallery-card-toggle">Show more</button>' : ''}
          </div>` : ''}
        </div>
      </div>`;
    }).join('');

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
    initShareButton('Gallery');
    initGalleryToggles();
    initLazyImages();
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
    initShareButton('Shower Thoughts');
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
    return `
      <a href="${itemHref(item)}" class="post-card">
        <div class="post-card-title">${escapeHtml(item.title)}</div>
        <div class="post-card-summary">${escapeHtml(item.summary || item.body || '')}</div>
        <div class="post-card-meta">
          ${item.date ? `<span class="post-card-date">${formatDate(item.date)}</span>` : ''}
          ${sectionLabel}
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

      const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,25 C240,50 480,0 720,25 C960,50 1200,0 1440,25 L1440,60 L0,60 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0,30 C120,10 240,50 360,30 C480,10 600,50 720,30 C840,10 960,50 1080,30 C1200,10 1320,50 1440,30 L1440,60 L0,60 Z"/></svg></div>`;

      showContent(`
        <div class="profile-hero" id="profile-hero">
          <div class="profile-hero-bg" id="profile-hero-bg" data-src="${escapeHtml(coverUrl)}"></div>
          <div class="profile-hero-skeleton"></div>
          <div class="profile-hero-overlay"></div>
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
        <div class="article-top-bar" style="margin-top:0">
          <div></div>
          ${shareButton(name)}
        </div>
        ${metaHtml}
        <div class="article-body">${html}</div>
      `);
      initParallax();
      initShareButton(name);
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
      const { body } = parseMarkdown(raw);
      const html = renderMd(body);
      showContent(`<div class="article-body">${html}</div>`);
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Page not found</h3></div>'); }
  }

  // ── Share ───────────────────────────────────────────────

  function shareButton(title) {
    return `<button class="share-btn" aria-label="Share">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Share</span>
    </button>`;
  }

  function initShareButton(title) {
    const btn = document.querySelector('.share-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const url = window.location.href;
      const text = title ? `${title} : ${url}` : url;
      if (navigator.share) {
        try { await navigator.share({ title, text, url }); } catch {}
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        const label = btn.querySelector('span');
        label.textContent = 'Copied!';
        setTimeout(() => { label.textContent = 'Share'; }, 2000);
      } catch {}
    });
  }

  // ── Image Lightbox in Articles ────────────────────────

  function initArticleImages() {
    document.querySelectorAll('.article-body pre code').forEach((el) => hljs.highlightElement(el));
    document.querySelectorAll('.article-body img').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
    initLazyImages();
  }

  function openLightbox(src, caption) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-caption').textContent = caption || '';
    lb.classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
  }

  window.__openLightbox = openLightbox;

  // ── Router ────────────────────────────────────────────

  async function handleRoute() {
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

    function openSearch() {
      overlay.classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
    }

    function closeSearch() {
      overlay.classList.add('hidden');
      input.value = '';
      results.innerHTML = '';
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
      if (e.key === 'Escape' && !lb.classList.contains('hidden')) closeLightbox();
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
