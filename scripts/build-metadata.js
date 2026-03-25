const fg = require("fast-glob");
const matter = require("gray-matter");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const yaml = require("js-yaml");
const MiniSearch = require("minisearch");
const sharp = require("sharp");
const terser = require("terser");
const { rollup } = require("rollup");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const postcss = require("postcss");
const cssnano = require("cssnano");
const { minify: minifyHtml } = require("html-minifier-next");

const REPO_ROOT = path.join(__dirname, "..");
const LOCAL_CONTENT_LINK = path.join(REPO_ROOT, "content");
const LOCAL_CONTENT_SOURCE = path.resolve(REPO_ROOT, "..", "raksara-content");
let CONTENT_DIR = "";
const METADATA_DIR = path.join(__dirname, "..", "metadata");
const WEB_DIR = path.join(__dirname, "..", "web");
const RESPONSIVE_DIR_NAME = ".raksara-responsive";
const RESPONSIVE_WIDTHS = [320, 480, 640, 960, 1280, 1600];

fs.mkdirSync(METADATA_DIR, { recursive: true });

function resolveContentDir() {
  const candidates = [
    LOCAL_CONTENT_LINK,
    path.join(__dirname, "..", "web", "content"),
    path.join(__dirname, "..", "content-template"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function setupLocalContentSymlink() {
  const isCi = process.env.GITHUB_ACTIONS === "true";
  if (isCi) return () => {};

  if (fs.existsSync(LOCAL_CONTENT_LINK)) return () => {};
  if (!fs.existsSync(LOCAL_CONTENT_SOURCE)) return () => {};

  fs.symlinkSync(LOCAL_CONTENT_SOURCE, LOCAL_CONTENT_LINK, "dir");
  console.log("  ✓ Linked content/ -> ../raksara-content");

  return function cleanupSymlink() {
    try {
      if (fs.existsSync(LOCAL_CONTENT_LINK)) {
        const stat = fs.lstatSync(LOCAL_CONTENT_LINK);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(LOCAL_CONTENT_LINK);
          console.log("  ✓ Removed local content/ symlink");
        }
      }
    } catch {
      // Best effort cleanup for local dev
    }
  };
}

function stripMarkdown(md) {
  return md
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_~]+/g, "")
    .replace(/\|.*\|/g, "")
    .replace(/[-=]{3,}/g, "")
    .replace(/>\s+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function buildMetadata() {
  console.log("Building metadata...\n");

  const files = await fg("**/*.md", { cwd: CONTENT_DIR });
  const posts = [];
  const portfolioItems = [];
  const galleryItems = [];
  const thoughts = [];
  const pages = [];
  const tags = {};
  const categories = {};
  const titleMap = {};

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { data, content } = matter(raw);
    const section = file.split(path.sep)[0];
    const slug =
      section === "blog"
        ? file.replace(/^blog\//, "").replace(/\.md$/, "")
        : path.basename(file, ".md");

    titleMap[`content/${file}`] = data.title || slug;

    const entry = {
      title: data.title || slug,
      slug,
      path: `content/${file}`,
      section,
      ...data,
    };

    if (section === "blog") {
      entry.date = data.date
        ? new Date(data.date).toISOString().split("T")[0]
        : "1970-01-01";
      entry.summary =
        data.summary || stripMarkdown(content).substring(0, 160) + "...";
      if (data.type) entry.type = data.type;
      if (data.cover) entry.cover = data.cover;
      if (data.series) entry.series = data.series;
      if (data.chapter) entry.chapter = data.chapter;
      if (data.readingMode) entry.readingMode = data.readingMode;
      const dir = path.dirname(slug);
      entry.dir = dir === "." ? "" : dir;
      posts.push(entry);
    } else if (section === "portfolio") {
      entry.date = data.date
        ? new Date(data.date).toISOString().split("T")[0]
        : "";
      entry.summary =
        data.summary || stripMarkdown(content).substring(0, 160) + "...";
      portfolioItems.push(entry);
    } else if (section === "gallery") {
      entry.date = data.date
        ? new Date(data.date).toISOString().split("T")[0]
        : "1970-01-01";
      entry.image = data.image || "";
      entry.images = data.images || [];
      entry.caption = data.caption || "";
      entry.description = stripMarkdown(content) || "";
      galleryItems.push(entry);
    } else if (section === "thoughts") {
      entry.date = data.date
        ? new Date(data.date).toISOString().split("T")[0]
        : "1970-01-01";
      entry.body = stripMarkdown(content);
      thoughts.push(entry);
    } else if (section === "pages") {
      pages.push(entry);
    }

    if (data.tags && Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        tags[tag] = (tags[tag] || 0) + 1;
      }
    }
    if (data.category) {
      categories[data.category] = (categories[data.category] || 0) + 1;
    }
  }

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  galleryItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  thoughts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const blogDirs = buildBlogDirs(posts);

  const searchDocs = [];
  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { data, content } = matter(raw);
    const section = file.split(path.sep)[0];
    const searchSlug =
      section === "blog"
        ? file.replace(/^blog\//, "").replace(/\.md$/, "")
        : path.basename(file, ".md");
    searchDocs.push({
      id: `content/${file}`,
      title: data.title || searchSlug,
      tags: (data.tags || []).join(" "),
      category: data.category || "",
      body: stripMarkdown(content).substring(0, 1000),
      section,
      slug: searchSlug,
    });
  }

  const miniSearch = new MiniSearch({
    fields: ["title", "tags", "category", "body"],
    storeFields: ["title", "section", "slug", "category"],
    searchOptions: {
      boost: { title: 3, tags: 2, category: 1.5 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  miniSearch.addAll(searchDocs);
  const searchIndex = JSON.parse(JSON.stringify(miniSearch));

  write("blog-dirs.json", blogDirs);
  write("posts.json", posts);
  write("portfolio.json", portfolioItems);
  write("gallery.json", galleryItems);
  write("thoughts.json", thoughts);
  write("pages.json", pages);
  write("tags.json", tags);
  write("categories.json", categories);
  write("search-index.json", searchIndex);

  const configPath = path.join(CONTENT_DIR, "raksara.yml");
  let siteConfig = { color: "purple" };
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === "object") {
      siteConfig = { ...siteConfig, ...parsed };
    }
  }
  write("config.json", siteConfig);

  copyMetadataToWeb();
  const imageManifest = await generateResponsiveImages();
  write("image-manifest.json", imageManifest);
  fs.copyFileSync(
    path.join(METADATA_DIR, "image-manifest.json"),
    path.join(WEB_DIR, "metadata", "image-manifest.json"),
  );
  prerender(posts, thoughts, portfolioItems, galleryItems, siteConfig, imageManifest);
  await generateSeoArtifacts({
    posts,
    portfolioItems,
    galleryItems,
    thoughts,
    pages,
    tags,
    categories,
    blogDirs,
  });

  console.log(`  Posts:      ${posts.length}`);
  console.log(`  Portfolio:  ${portfolioItems.length}`);
  console.log(`  Gallery:    ${galleryItems.length}`);
  console.log(`  Thoughts:   ${thoughts.length}`);
  console.log(`  Pages:      ${pages.length}`);
  console.log(`  Tags:       ${Object.keys(tags).length}`);
  console.log(`  Categories: ${Object.keys(categories).length}`);
  console.log("\nMetadata build complete.");
}

function buildBlogDirs(posts) {
  const dirs = {};
  const allDirPaths = new Set([""]);
  for (const p of posts) {
    const d = p.dir || "";
    allDirPaths.add(d);
    const parts = d.split("/").filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      allDirPaths.add(parts.slice(0, i).join("/"));
    }
  }
  for (const d of allDirPaths) {
    const childDirs = new Set();
    const childPosts = [];
    for (const p of posts) {
      const pd = p.dir || "";
      if (pd === d) {
        childPosts.push(p.slug);
      } else if (
        d === ""
          ? !pd.includes("/") && pd !== ""
          : pd.startsWith(d + "/") && !pd.slice(d.length + 1).includes("/")
      ) {
        childDirs.add(d === "" ? pd : pd.slice(d.length + 1));
      }
    }
    dirs[d] = { subdirs: [...childDirs].sort(), posts: childPosts };
  }
  return dirs;
}

function write(filename, data) {
  const filepath = path.join(METADATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data));
  console.log(`  ✓ ${filename}`);
}

function copyMetadataToWeb() {
  const webMetaDir = path.join(WEB_DIR, "metadata");
  fs.mkdirSync(webMetaDir, { recursive: true });
  const metaFiles = fs.readdirSync(METADATA_DIR);
  for (const f of metaFiles) {
    fs.copyFileSync(path.join(METADATA_DIR, f), path.join(webMetaDir, f));
  }

  const contentWebDir = path.join(WEB_DIR, "content");
  if (path.resolve(CONTENT_DIR) !== path.resolve(contentWebDir)) {
    copyDirRecursive(CONTENT_DIR, contentWebDir);
  }
  console.log("  ✓ Copied metadata and content to web/");
}

async function generateSeoArtifacts({
  posts,
  portfolioItems,
  galleryItems,
  thoughts,
  pages,
  tags,
  categories,
  blogDirs,
}) {
  const siteUrl = getSiteUrl();
  const routes = collectRoutes({
    posts,
    portfolioItems,
    galleryItems,
    thoughts,
    pages,
    tags,
    categories,
    blogDirs,
  });

  writeWebFile("sitemap.xml", buildSitemapXml(siteUrl, routes));
  writeWebFile(
    "robots.txt",
    ["User-agent: *", "Allow: /", "", `Sitemap: ${siteUrl}/sitemap.xml`, ""].join(
      "\n",
    ),
  );
  await generateStaticRoutePages(routes);

  console.log("  ✓ Generated sitemap.xml");
  console.log("  ✓ Generated robots.txt");
  console.log(`  ✓ Generated route pages (${routes.length})`);
}

function getSiteUrl() {
  const configured =
    process.env.SITE_URL ||
    process.env.BASE_URL;
  if (configured) return normalizeSiteUrl(configured);

  const repo = process.env.GITHUB_REPOSITORY || "";
  const owner = repo.split("/")[0] || guessGitHubOwnerFromLocalGit();
  if (owner) return `https://${owner}.github.io`;
  return "https://example.github.io";
}

function guessGitHubOwnerFromLocalGit() {
  try {
    try {
      const remote = execSync("git config --get remote.origin.url", {
        cwd: path.join(__dirname, ".."),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const owner = extractGitHubOwnerFromRemote(remote);
      if (owner) return owner;
    } catch {
      // fall back to parsing .git/config directly
    }

    const gitConfigPath = path.join(__dirname, "..", ".git", "config");
    if (!fs.existsSync(gitConfigPath)) return "";
    const text = fs.readFileSync(gitConfigPath, "utf-8");
    const remoteMatch = text.match(/url\s*=\s*(.+)/);
    if (!remoteMatch) return "";
    return extractGitHubOwnerFromRemote(remoteMatch[1].trim());
  } catch {
    return "";
  }
}

function extractGitHubOwnerFromRemote(remote) {
  if (!remote) return "";
  const ssh = remote.match(/^git@github\.com:([^/]+)\//i);
  if (ssh) return ssh[1];
  const https = remote.match(/^https?:\/\/github\.com\/([^/]+)\//i);
  if (https) return https[1];
  return "";
}

function normalizeSiteUrl(url) {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withProtocol.replace(/\/+$/, "");
}

function collectRoutes({
  posts,
  portfolioItems,
  galleryItems,
  thoughts,
  pages,
  tags,
  categories,
  blogDirs,
}) {
  const routes = new Set([
    "/",
    "/blog",
    "/portfolio",
    "/gallery",
    "/thoughts",
    "/tags",
    "/categories",
    "/profile",
    "/about",
  ]);

  for (const p of posts) routes.add(`/blog/post/${p.slug}`);
  for (const p of portfolioItems) routes.add(`/portfolio/${p.slug}`);
  for (const page of pages) routes.add(`/${page.slug}`);

  for (const d of Object.keys(blogDirs || {})) {
    if (!d) continue;
    routes.add(`/blog/dir/${d}`);
  }

  for (const t of Object.keys(tags || {})) {
    routes.add(`/tag/${encodeURIComponent(t)}`);
  }
  for (const c of Object.keys(categories || {})) {
    routes.add(`/category/${encodeURIComponent(c)}`);
  }

  if (galleryItems.length > 0) {
    for (let i = 0; i < galleryItems.length; i += 1) {
      routes.add(`/gallery/${i}`);
    }
  }

  if (thoughts.length === 0) routes.add("/thoughts");

  return Array.from(routes).sort();
}

function buildSitemapXml(siteUrl, routes) {
  const now = new Date().toISOString();
  const urls = routes
    .map((route) => {
      const clean = route === "/" ? "" : route;
      return [
        "  <url>",
        `    <loc>${escapeXml(siteUrl + clean)}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generateStaticRoutePages(routes) {
  const srcIndexPath = path.join(WEB_DIR, "index.html");
  if (!fs.existsSync(srcIndexPath)) return;
  const srcHtml = fs.readFileSync(srcIndexPath, "utf-8");

  for (const route of routes) {
    if (route === "/") continue;
    const routePath = route.replace(/^\/+/, "");
    const depth = routePath.split("/").filter(Boolean).length;
    const baseHref = `${"../".repeat(depth)}` || "./";
    const htmlWithBase = await minifyHtmlDocument(
      injectOrReplaceBaseHref(srcHtml, baseHref),
    );
    const outDir = path.join(WEB_DIR, routePath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), htmlWithBase);
  }

  // Keep root index explicitly base-aware for consistent relative loading.
  fs.writeFileSync(
    path.join(WEB_DIR, "index.html"),
    await minifyHtmlDocument(injectOrReplaceBaseHref(srcHtml, "./")),
  );
}

function injectOrReplaceBaseHref(html, baseHref) {
  if (/<base\s+href=/i.test(html)) {
    return html.replace(/<base\s+href=["'][^"']*["']\s*\/?\s*>/i, `<base href="${baseHref}">`);
  }
  return html.replace("<head>", `<head>\n        <base href="${baseHref}">`);
}

function writeWebFile(filename, content) {
  const filepath = path.join(WEB_DIR, filename);
  fs.writeFileSync(filepath, content);
}

function copyHighlightRuntime() {
  try {
    const packageRoot = path.join(REPO_ROOT, "node_modules", "highlight.js");
    const srcEsDir = path.join(packageRoot, "es");
    const srcLibDir = path.join(packageRoot, "lib");
    const destRoot = path.join(WEB_DIR, "vendor", "hljs");

    if (!fs.existsSync(srcEsDir) || !fs.existsSync(srcLibDir)) {
      console.log("  ⚠ highlight.js runtime not found, skipping language module copy");
      return;
    }

    fs.rmSync(destRoot, { recursive: true, force: true });
    copyDirRecursive(srcEsDir, path.join(destRoot, "es"));
    copyDirRecursive(srcLibDir, path.join(destRoot, "lib"));
    console.log("  ✓ Highlight.js runtime copied for on-demand language loading");
  } catch (err) {
    console.error("  ✗ Highlight runtime copy failed:", err.message);
  }
}

async function minifyHtmlDocument(html) {
  try {
    return await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyCSS: true,
      minifyJS: true,
    });
  } catch (err) {
    console.error("  ⚠ HTML minification skipped:", err.message);
    return html;
  }
}

const SKIP_DIRS = new Set([".git", "node_modules", ".github"]);

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function generateResponsiveImages() {
  const contentWebDir = path.join(WEB_DIR, "content");
  if (!fs.existsSync(contentWebDir)) {
    return {};
  }

  const responsiveRoot = path.join(contentWebDir, RESPONSIVE_DIR_NAME);
  fs.rmSync(responsiveRoot, { recursive: true, force: true });

  const imageFiles = await fg(["**/*.{jpg,jpeg,png,webp,avif}"], {
    cwd: contentWebDir,
    onlyFiles: true,
    ignore: [`${RESPONSIVE_DIR_NAME}/**`],
  });

  const manifest = {};

  for (const relativeFile of imageFiles) {
    const normalizedRelativeFile = relativeFile.replace(/\\/g, "/");
    const absoluteFile = path.join(contentWebDir, relativeFile);

    let metadata;
    try {
      metadata = await sharp(absoluteFile).metadata();
    } catch {
      continue;
    }

    if (!metadata.width || !metadata.height) {
      continue;
    }

    const publicPath = `content/${normalizedRelativeFile}`;
    const parsed = path.posix.parse(normalizedRelativeFile);
    const variantDir = path.join(responsiveRoot, parsed.dir);
    fs.mkdirSync(variantDir, { recursive: true });

    const variants = [];
    const usableWidths = RESPONSIVE_WIDTHS.filter(
      (width) => width < metadata.width,
    );

    for (const width of usableWidths) {
      const variantFileName = `${parsed.name}-${width}w${parsed.ext}`;
      const variantAbsolutePath = path.join(variantDir, variantFileName);
      const variantPublicPath = path.posix.join(
        "content",
        RESPONSIVE_DIR_NAME,
        parsed.dir,
        variantFileName,
      );

      await sharp(absoluteFile)
        .resize({ width, withoutEnlargement: true })
        .toFile(variantAbsolutePath);

      variants.push({
        width,
        path: variantPublicPath,
      });
    }

    manifest[publicPath] = {
      width: metadata.width,
      height: metadata.height,
      variants,
    };
  }

  console.log(`  ✓ Responsive images generated (${Object.keys(manifest).length})`);
  return manifest;
}

/* ── Prerendering Utilities ──────────────────────────────── */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

function buildResponsiveImageAttrsPrerender(src, options = {}, imageManifest) {
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
  } = options;

  const attrs = [`src="${escapeHtml(resolved)}"`, `alt="${escapeHtml(alt)}"`];
  const manifestEntry = imageManifest[resolved];

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
          .filter((variant) => variant && variant.path && variant.width)
          .sort((left, right) => left.width - right.width)
      : [];
    const srcset = variants.map(
      (variant) => `${escapeHtml(resolvePath(variant.path))} ${variant.width}w`,
    );

    if (manifestEntry.width) {
      srcset.push(`${escapeHtml(resolved)} ${manifestEntry.width}w`);
      attrs.push(`width="${manifestEntry.width}"`);
    }
    if (manifestEntry.height) {
      attrs.push(`height="${manifestEntry.height}"`);
    }
    if (srcset.length) {
      attrs.push(`srcset="${srcset.join(", ")}"`);
    }
  }

  attrs.push(`sizes="${escapeHtml(sizes)}"`);
  return attrs.join(" ");
}

function renderPostCardPrerender(post, options = {}, imageManifest) {
  const coverSrc = post.cover ? resolvePath(post.cover) : "";
  const imageLoading = options.imageLoading || "lazy";
  const fetchPriority = options.fetchPriority || "auto";
  const thumbHtml = coverSrc
    ? `<div class="post-card-thumb is-loading"><img ${buildResponsiveImageAttrsPrerender(coverSrc, {
        alt: post.title || "",
        loading: imageLoading,
        fetchPriority,
        sizes: "(max-width: 480px) 100px, (max-width: 640px) 120px, 180px",
      }, imageManifest)}></div>`
    : "";
  return `
      <a href="#/blog/post/${post.slug}" class="post-card${coverSrc ? " has-thumb" : ""}">
        ${thumbHtml}
        <div class="post-card-body">
          <div class="post-card-title">${escapeHtml(post.title)}</div>
          <div class="post-card-summary">${escapeHtml(post.summary || "")}</div>
          <div class="post-card-meta">
            <span class="post-card-date">${formatDate(post.date)}</span>
            ${post.category ? `<span class="post-card-category">${escapeHtml(post.category)}</span>` : ""}
            ${(post.tags || []).map((t) => `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(t)}</span>`).join("")}
          </div>
        </div>
      </a>`;
}

function renderThoughtCardPrerender(thought) {
  const tagsHtml = (thought.tags || [])
    .map(
      (tag) =>
        `<span class="tag" style="padding:2px 8px;font-size:11px">${escapeHtml(tag)}</span>`,
    )
    .join("");
  return `
      <div class="thought-card">
        <div class="thought-body">${escapeHtml(thought.body || "")}</div>
        <div class="thought-meta">
          <span class="thought-title">${escapeHtml(thought.title)}</span>
          <span>·</span>
          <span class="post-card-date">${formatDate(thought.date)}</span>
          ${tagsHtml}
        </div>
      </div>`;
}

function renderPortfolioCardPrerender(portfolio) {
  const tagsHtml = (portfolio.tags || [])
    .map(
      (t) =>
        `<span class="tag" style="padding:3px 10px;font-size:11px">${escapeHtml(t)}</span>`,
    )
    .join("");
  const links = [];
  if (portfolio.github)
    links.push(
      `<a href="${escapeHtml(portfolio.github)}" class="btn-github" target="_blank" rel="noopener"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>`,
    );
  if (portfolio.demo)
    links.push(
      `<a href="${escapeHtml(portfolio.demo)}" class="btn-demo" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 3h7v7M13 3L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Demo</a>`,
    );
  return `
      <div class="portfolio-card" data-href="#/portfolio/${portfolio.slug}">
        <div class="portfolio-card-title">${escapeHtml(portfolio.title)}</div>
        <div class="portfolio-card-summary">${escapeHtml(portfolio.summary || "")}</div>
        <div class="portfolio-card-tags">${tagsHtml}</div>
        ${links.length ? `<div class="portfolio-card-links">${links.join("")}</div>` : ""}
      </div>`;
}

function renderHomePagePrerender(posts, thoughts, portfolio, gallery, config, imageManifest) {
  const recentPosts = posts.slice(0, 3);
  const recentThoughts = thoughts.slice(0, 2);

  let postsHtml = recentPosts
    .map((post, index) =>
      renderPostCardPrerender(post, {
        imageLoading: index === 0 ? "eager" : "lazy",
        fetchPriority: index === 0 ? "high" : "auto",
      }, imageManifest),
    )
    .join("");

  let portfolioHtml = portfolio
    .slice(0, 4)
    .map((p) => renderPortfolioCardPrerender(p))
    .join("");

  let thoughtsHtml = recentThoughts.map((t) => renderThoughtCardPrerender(t)).join("");

  let galleryHtml = gallery
    .slice(0, 4)
    .map((g) => {
      const images = g.images && g.images.length > 0 ? g.images : 
                    g.image ? [{ src: g.image }] : [];
      if (!images.length) return "";
      const imgSrc = resolvePath(images[0].src);
      const isMulti = images.length > 1;
      const countBadge = isMulti
        ? `<div class="gallery-image-count"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="9" height="9" rx="1.5"/><rect x="5" y="5" width="9" height="9" rx="1.5"/></svg>${images.length}</div>`
        : "";
      const galleryIndex = gallery.indexOf(g);
      return `
      <div class="gallery-item is-loading${isMulti ? " multi-image" : ""}" onclick="window.__openGallery(${galleryIndex})">
        <img ${buildResponsiveImageAttrsPrerender(imgSrc, {
          alt: g.title || "",
          loading: "lazy",
          sizes: "(max-width: 768px) calc(50vw - 24px), 240px",
        }, imageManifest)}>
        <div class="gallery-item-overlay">
          <div class="gallery-item-title">${escapeHtml(g.title)}</div>
        </div>
        ${countBadge}
      </div>`;
    })
    .join("");

  const heroTitle = (config && config.hero_title) || "Raksara";
  const heroSubtitle =
    (config && config.hero_subtitle) ||
    "A place where ideas, knowledge, and engineering thoughts are recorded.";

  const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg></div>`;

  return `<div class="home-hero" id="profile-hero">
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
        <div class="home-section-header"><h2>Recent Posts</h2><a href="#/blog">View all →</a></div>
        <div class="post-list">${postsHtml || '<div class="empty-state"><p>No posts yet.</p></div>'}</div>
      </div>

      ${
        thoughtsHtml
          ? `<div class="home-section">
        <div class="home-section-header"><h2>Shower Thoughts</h2><a href="#/thoughts">View all →</a></div>
        <div class="thoughts-list">${thoughtsHtml}</div>
      </div>`
          : ""
      }

      <div class="home-section">
        <div class="home-section-header"><h2>Projects</h2><a href="#/portfolio">View all →</a></div>
        <div class="portfolio-grid">${portfolioHtml || '<div class="empty-state"><p>No projects yet.</p></div>'}</div>
      </div>

      ${
        galleryHtml
          ? `<div class="home-section">
        <div class="home-section-header"><h2>Gallery</h2><a href="#/gallery">View all →</a></div>
        <div class="gallery-grid">${galleryHtml}</div>
      </div>`
          : ""
      }`;
}

function prerender(posts, thoughts, portfolio, gallery, config, imageManifest) {
  const homeMarkup = renderHomePagePrerender(posts, thoughts, portfolio, gallery, config, imageManifest);
  const cacheFile = path.join(METADATA_DIR, "home-prerender.json");
  fs.writeFileSync(cacheFile, JSON.stringify({ html: homeMarkup }), "utf-8");
  fs.copyFileSync(
    cacheFile,
    path.join(WEB_DIR, "metadata", "home-prerender.json"),
  );
  console.log("  ✓ Prerendered homepage markup");
}

async function minifyCSS() {
  try {
    const cssPath = path.join(WEB_DIR, "styles.css");
    const minCssPath = path.join(WEB_DIR, "styles.min.css");
    
    if (!fs.existsSync(cssPath)) {
      console.log("  ⚠ styles.css not found, skipping CSS minification");
      return;
    }

    const css = fs.readFileSync(cssPath, "utf-8");

    const result = await postcss([cssnano({ preset: "default" })]).process(css, {
      from: cssPath,
      to: minCssPath,
    });
    const minified = result.css;

    fs.writeFileSync(minCssPath, minified, "utf-8");

    const originalSize = css.length;
    const minifiedSize = minified.length;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`  ✓ CSS minified: ${(originalSize/1024).toFixed(1)} KB → ${(minifiedSize/1024).toFixed(1)} KB (${savings}% savings)`);
  } catch (err) {
    console.error("  ✗ CSS minification failed:", err.message);
  }
}

async function bundleBrowserVendor({ inputPath, outputPath, name }) {
  const bundle = await rollup({
    input: inputPath,
    treeshake: true,
    plugins: [
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
    ],
  });

  const generated = await bundle.generate({
    format: "iife",
    name,
  });
  await bundle.close();

  const code = generated.output[0] && generated.output[0].code;
  if (!code) throw new Error(`Rollup produced empty output for ${path.basename(inputPath)}`);

  const minified = await terser.minify(code, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  if (!minified.code) throw new Error(`Terser produced empty output for ${path.basename(inputPath)}`);

  fs.writeFileSync(outputPath, minified.code, "utf-8");
  return minified.code.length;
}

async function bundleVendorJS() {
  try {
    const markdownInput = path.join(REPO_ROOT, "scripts", "vendor-markdown-entry.js");
    const searchInput = path.join(REPO_ROOT, "scripts", "vendor-search-entry.js");
    const markdownOutput = path.join(WEB_DIR, "vendor-markdown.min.js");
    const searchOutput = path.join(WEB_DIR, "vendor-search.min.js");

    if (!fs.existsSync(markdownInput) || !fs.existsSync(searchInput)) {
      console.log("  ⚠ vendor entry files not found, skipping Rollup vendor bundles");
      return;
    }

    const markdownSize = await bundleBrowserVendor({
      inputPath: markdownInput,
      outputPath: markdownOutput,
      name: "RaksaraMarkdownVendor",
    });
    const searchSize = await bundleBrowserVendor({
      inputPath: searchInput,
      outputPath: searchOutput,
      name: "RaksaraSearchVendor",
    });

    console.log(`  ✓ Markdown vendor bundle: ${(markdownSize/1024).toFixed(1)} KB`);
    console.log(`  ✓ Search vendor bundle: ${(searchSize/1024).toFixed(1)} KB`);
  } catch (err) {
    console.error("  ✗ Vendor bundle failed:", err.message);
  }
}

async function minifyJS() {
  try {
    const jsPath = path.join(WEB_DIR, "app.js");
    const minJsPath = path.join(WEB_DIR, "app.min.js");

    if (!fs.existsSync(jsPath)) {
      console.log("  ⚠ app.js not found, skipping JS minification");
      return;
    }

    const js = fs.readFileSync(jsPath, "utf-8");
    const result = await terser.minify(js, {
      compress: {
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    });

    if (!result.code) {
      throw new Error("Terser produced empty output");
    }

    const minified = result.code;

    fs.writeFileSync(minJsPath, minified, "utf-8");

    const originalSize = js.length;
    const minifiedSize = minified.length;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`  ✓ JS minified: ${(originalSize/1024).toFixed(1)} KB → ${(minifiedSize/1024).toFixed(1)} KB (${savings}% savings)`);
  } catch (err) {
    console.error("  ✗ JS minification failed:", err.message);
  }
}

async function runBuild() {
  const cleanupSymlink = setupLocalContentSymlink();
  CONTENT_DIR = resolveContentDir();
  try {
    await buildMetadata();
    copyHighlightRuntime();
    await minifyCSS();
    await bundleVendorJS();
    await minifyJS();
  } finally {
    cleanupSymlink();
  }
}

runBuild().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
