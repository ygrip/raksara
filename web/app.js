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
    tree: null,
    searchIndex: null,
    miniSearch: null,
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
      const [posts, portfolio, gallery, thoughts, pages, tags, categories, tree, searchIndex] = await Promise.all([
        loadJSON('metadata/posts.json'),
        loadJSON('metadata/portfolio.json'),
        loadJSON('metadata/gallery.json'),
        loadJSON('metadata/thoughts.json'),
        loadJSON('metadata/pages.json'),
        loadJSON('metadata/tags.json'),
        loadJSON('metadata/categories.json'),
        loadJSON('metadata/tree.json'),
        loadJSON('metadata/search-index.json'),
      ]);
      Object.assign(state, { posts, portfolio, gallery, thoughts, pages, tags, categories, tree, searchIndex, loaded: true });

      state.miniSearch = MiniSearch.loadJS(searchIndex, {
        fields: ['title', 'tags', 'category', 'body'],
        storeFields: ['title', 'section', 'slug', 'category'],
      });

      renderNavTree(tree);
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
      for (const line of lines) {
        const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (kv) {
          currentKey = kv[1];
          const val = kv[2].trim().replace(/^["']|["']$/g, '');
          if (val === '') {
            frontmatter[currentKey] = [];
            arrayMode = true;
          } else {
            frontmatter[currentKey] = val;
            arrayMode = false;
          }
        } else if (arrayMode && currentKey && line.match(/^\s+-\s+/)) {
          const item = line.replace(/^\s+-\s+/, '').trim();
          if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = [];
          frontmatter[currentKey].push(item);
        }
      }
    }
    return { frontmatter, body };
  }

  function renderMd(md) {
    const renderer = new marked.Renderer();
    const defaultImage = renderer.image.bind(renderer);
    renderer.image = function (href, title, text) {
      const resolved = resolvePath(typeof href === 'object' ? href.href : href);
      return `<img src="${resolved}" alt="${text || ''}"${title ? ` title="${title}"` : ''}>`;
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

  // ── Navigation Tree (uses titles) ─────────────────────

  function renderNavTree(tree) {
    const container = document.getElementById('nav-tree');
    if (!tree || !tree.children) return;
    let html = '<div class="nav-tree-label">Content Tree</div>';
    html += renderTreeNode(tree);
    container.innerHTML = html;
    container.querySelectorAll('.tree-folder-name').forEach((el) => {
      el.addEventListener('click', () => {
        el.querySelector('.arrow').classList.toggle('open');
        el.nextElementSibling.classList.toggle('collapsed');
      });
    });
  }

  function renderTreeNode(node) {
    if (!node.children) return '';
    let html = '';
    for (const child of node.children) {
      if (child.type === 'folder') {
        const label = child.name.charAt(0).toUpperCase() + child.name.slice(1);
        html += `<div class="tree-folder">
          <div class="tree-folder-name"><span class="arrow open">\u25B6</span> ${escapeHtml(label)}</div>
          <div class="tree-children">${renderTreeNode(child)}</div>
        </div>`;
      } else {
        const displayTitle = child.title || child.name.replace(/\.md$/, '');
        const slug = child.name.replace(/\.md$/, '');
        const section = child.path ? child.path.split('/')[1] : '';
        let href = '#/';
        if (section === 'blog') href = `#/blog/post/${slug}`;
        else if (section === 'portfolio') href = `#/portfolio/${slug}`;
        else if (section === 'gallery') href = `#/gallery`;
        else if (section === 'thoughts') href = `#/thoughts`;
        else if (section === 'pages') href = `#/${slug}`;
        html += `<a class="tree-file" href="${href}">${escapeHtml(displayTitle)}</a>`;
      }
    }
    return html;
  }

  // ── Page Renderers ────────────────────────────────────

  function renderHome() {
    const recentPosts = state.posts.slice(0, 3);
    const recentThoughts = state.thoughts.slice(0, 2);

    let postsHtml = recentPosts.map((p) => `
      <a href="#/blog/post/${p.slug}" class="post-card">
        <div class="post-card-title">${escapeHtml(p.title)}</div>
        <div class="post-card-summary">${escapeHtml(p.summary || '')}</div>
        <div class="post-card-meta">
          <span class="post-card-date">${formatDate(p.date)}</span>
          ${p.category ? `<span class="post-card-category">${escapeHtml(p.category)}</span>` : ''}
        </div>
      </a>`).join('');

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

    showContent(`
      <div class="home-parallax-hero" id="profile-hero">
        <div class="home-parallax-bg" id="home-hero-bg"></div>
        <div class="home-parallax-overlay"></div>
        <div class="home-parallax-content">
          <h1>Welcome to <span class="accent-gradient">Raksara</span></h1>
          <p>A place where ideas, knowledge, and engineering thoughts are recorded. Explore blog posts, projects, and more.</p>
        </div>
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
  }

  // ── Blog ──────────────────────────────────────────────

  function renderBlogList(page) {
    page = parseInt(page) || 1;
    const total = state.posts.length;
    const totalPages = Math.ceil(total / POSTS_PER_PAGE);
    const start = (page - 1) * POSTS_PER_PAGE;
    const pagePosts = state.posts.slice(start, start + POSTS_PER_PAGE);

    let postsHtml = pagePosts.map((p) => `
      <a href="#/blog/post/${p.slug}" class="post-card">
        <div class="post-card-title">${escapeHtml(p.title)}</div>
        <div class="post-card-summary">${escapeHtml(p.summary || '')}</div>
        <div class="post-card-meta">
          <span class="post-card-date">${formatDate(p.date)}</span>
          ${p.category ? `<span class="post-card-category">${escapeHtml(p.category)}</span>` : ''}
          ${(p.tags || []).map((t) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(t)}</span>`).join('')}
        </div>
      </a>`).join('');

    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = '<div class="pagination">';
      if (page > 1) paginationHtml += `<a href="#/blog/page/${page - 1}">\u2190 Prev</a>`;
      for (let i = 1; i <= totalPages; i++) {
        paginationHtml += i === page ? `<span class="active">${i}</span>` : `<a href="#/blog/page/${i}">${i}</a>`;
      }
      if (page < totalPages) paginationHtml += `<a href="#/blog/page/${page + 1}">Next \u2192</a>`;
      paginationHtml += '</div>';
    }

    showContent(`
      <h1 class="page-title">Blog</h1>
      <p class="page-subtitle">${total} post${total !== 1 ? 's' : ''}</p>
      <div class="post-list">${postsHtml}</div>
      ${paginationHtml}
    `);
  }

  async function renderBlogPost(slug) {
    showLoading();
    const post = state.posts.find((p) => p.slug === slug);
    if (!post) { showContent('<div class="empty-state"><h3>Post not found</h3></div>'); return; }
    try {
      const raw = await loadMarkdown(post.path);
      const { body } = parseMarkdown(raw);
      const html = renderMd(body);
      const tagsHtml = (post.tags || []).map((t) => `<a href="#/tag/${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`).join('');
      showContent(`
        <a href="#/blog" class="back-link">\u2190 Back to blog</a>
        <div class="article-header">
          <h1>${escapeHtml(post.title)}</h1>
          <div class="article-meta">
            <span class="post-card-date">${formatDate(post.date)}</span>
            ${post.category ? `<a href="#/category/${encodeURIComponent(post.category)}" class="post-card-category">${escapeHtml(post.category)}</a>` : ''}
            ${tagsHtml}
          </div>
        </div>
        <div class="article-body">${html}</div>
      `);
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
    showContent(`
      <h1 class="page-title">Portfolio</h1>
      <p class="page-subtitle">${state.portfolio.length} project${state.portfolio.length !== 1 ? 's' : ''}</p>
      <div class="portfolio-grid">${state.portfolio.map(renderPortfolioCard).join('')}</div>
    `);
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
        <a href="#/portfolio" class="back-link">\u2190 Back to portfolio</a>
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
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Failed to load project</h3></div>'); }
  }

  // ── Gallery ───────────────────────────────────────────

  function renderGallery() {
    const items = state.gallery.map((g) => {
      const imgSrc = resolvePath(g.image);
      return `
      <div class="gallery-item" onclick="window.__openLightbox('${escapeHtml(imgSrc)}','${escapeHtml(g.caption)}')">
        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(g.title)}" loading="lazy">
        <div class="gallery-item-overlay">
          <div class="gallery-item-title">${escapeHtml(g.title)}</div>
          <div class="gallery-item-caption">${escapeHtml(g.caption)}</div>
        </div>
      </div>`;
    }).join('');

    showContent(`
      <h1 class="page-title">Gallery</h1>
      <p class="page-subtitle">${state.gallery.length} photo${state.gallery.length !== 1 ? 's' : ''}</p>
      <div class="gallery-grid">${items}</div>
    `);
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
      <h1 class="page-title">Shower Thoughts</h1>
      <p class="page-subtitle">Random ideas that pop in my mind</p>
      <div class="thoughts-list">${html || '<div class="empty-state"><p>No thoughts yet. Brain empty.</p></div>'}</div>
    `);
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

      showContent(`
        <div class="profile-hero" id="profile-hero">
          <div class="profile-hero-bg" id="profile-hero-bg" style="background-image:url('${escapeHtml(coverUrl)}')"></div>
          <div class="profile-hero-overlay"></div>
          <div class="profile-hero-content">
            ${avatarUrl ? `<img class="profile-avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}">` : ''}
            <div class="profile-info">
              <h1>${escapeHtml(name)}</h1>
              ${role ? `<div class="profile-role">${escapeHtml(role)}</div>` : ''}
              ${links.length ? `<div class="profile-links">${links.join('')}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="article-body">${html}</div>
      `);
      initParallax();
      initArticleImages();
    } catch { showContent('<div class="empty-state"><h3>Profile not found</h3></div>'); }
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

  // ── Image Lightbox in Articles ────────────────────────

  function initArticleImages() {
    document.querySelectorAll('.article-body pre code').forEach((el) => hljs.highlightElement(el));
    document.querySelectorAll('.article-body img').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.src, img.alt));
    });
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
    else if (parts[0] === 'blog' && parts[1] === 'post' && parts[2]) await renderBlogPost(parts[2]);
    else if (parts[0] === 'blog' && parts[1] === 'page' && parts[2]) renderBlogList(parseInt(parts[2]));
    else if (parts[0] === 'blog') renderBlogList(1);
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

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('raksara-theme', next);
    document.getElementById('hljs-dark').disabled = next === 'light';
    document.getElementById('hljs-light').disabled = next === 'dark';
  }

  function initTheme() {
    const saved = localStorage.getItem('raksara-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
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

    header.querySelector('.mobile-theme-toggle').addEventListener('click', toggleTheme);

    const sidebar = document.getElementById('sidebar');
    header.querySelector('.mobile-menu-btn').addEventListener('click', () => sidebar.classList.toggle('open'));
    document.getElementById('content').addEventListener('click', () => sidebar.classList.remove('open'));
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
