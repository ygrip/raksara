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
const { imagesToIco } = require("png-to-ico");

const REPO_ROOT = path.join(__dirname, "..");
const LOCAL_CONTENT_LINK = path.join(REPO_ROOT, "content");
const LOCAL_CONTENT_SOURCE = path.resolve(REPO_ROOT, "..", "raksara-content");
let CONTENT_DIR = "";
const METADATA_DIR = path.join(__dirname, "..", "metadata");
const WEB_DIR = path.join(__dirname, "..", "web");
const RESPONSIVE_DIR_NAME = ".raksara-responsive";
const RESPONSIVE_WIDTHS = [320, 480, 640, 960, 1280, 1600];
const BUILD_CACHE_BUST = String(Date.now());
const COLOR_TONES = {
  purple: { accent: "#6366f1", hoverDark: "#818cf8", hoverLight: "#4f46e5", g1: "#6366f1", g2: "#8b5cf6", g3: "#a855f7", rgb: "99,102,241" },
  blue: { accent: "#3b82f6", hoverDark: "#60a5fa", hoverLight: "#2563eb", g1: "#3b82f6", g2: "#06b6d4", g3: "#0ea5e9", rgb: "59,130,246" },
  red: { accent: "#ef4444", hoverDark: "#f87171", hoverLight: "#dc2626", g1: "#ef4444", g2: "#f43f5e", g3: "#ec4899", rgb: "239,68,68" },
  yellow: { accent: "#eab308", hoverDark: "#facc15", hoverLight: "#ca8a04", g1: "#eab308", g2: "#f59e0b", g3: "#f97316", rgb: "234,179,8" },
  green: { accent: "#22c55e", hoverDark: "#4ade80", hoverLight: "#16a34a", g1: "#22c55e", g2: "#10b981", g3: "#14b8a6", rgb: "34,197,94" },
  orange: { accent: "#f97316", hoverDark: "#fb923c", hoverLight: "#ea580c", g1: "#f97316", g2: "#fb923c", g3: "#fbbf24", rgb: "249,115,22" },
};
const VALID_STATUSES = new Set(["draft", "ongoing", "completed"]);

fs.mkdirSync(METADATA_DIR, { recursive: true });

function resolveContentDir() {
  const explicit = process.env.CONTENT_DIR && path.resolve(REPO_ROOT, process.env.CONTENT_DIR);
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = [
    LOCAL_CONTENT_LINK,
    path.join(__dirname, "..", "content-template"),
    path.join(__dirname, "..", "web", "content"),
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
    .replace(/::[\w-]+\s*\([^)]*\)/g, "")
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

function getConfiguredAccentColorName(config) {
  if (!config || typeof config !== "object") return "purple";
  return (
    config.color ||
    config.color_tone ||
    config.colorTone ||
    config.accent ||
    config.accent_color ||
    config.accentColor ||
    "purple"
  );
}

function getAccentPalette(config) {
  const colorName = String(getConfiguredAccentColorName(config) || "purple").toLowerCase();
  return COLOR_TONES[colorName] || COLOR_TONES.purple;
}

function shouldIncludeInSearch(section) {
  return ["blog", "portfolio", "pages"].includes(section);
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : "";
}

/**
 * Auto-quote YAML scalar values that contain `: ` (colon-space), which is
 * reserved as a mapping indicator in YAML block scalars. Runs before gray-matter
 * so files written without quoting still parse cleanly.
 */
function sanitizeFrontmatter(raw) {
  const fenceRe = /^---\r?\n([\s\S]*?)\n---/;
  const match = raw.match(fenceRe);
  if (!match) return raw;

  const sanitizedBlock = match[1]
    .split("\n")
    .map((line) => {
      // Match any simple scalar key: value line (not already in block/flow mode)
      const m = line.match(/^(\s*([\w][\w-]*)\s*:\s+)(.*\S.*)$/);
      if (!m) return line;
      const [, prefix, , value] = m;
      const trimmed = value.trim();
      // Skip: already quoted, YAML block/flow indicators, pure numbers, dates
      if (/^['"{[\|>!&*]/.test(trimmed)) return line;
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || /^\d+(\.\d+)?$/.test(trimmed)) return line;
      // If the value contains `: ` it must be quoted to be valid YAML
      if (/:\s/.test(trimmed) || trimmed.endsWith(":")) {
        const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return prefix + '"' + escaped + '"';
      }
      return line;
    })
    .join("\n");

  return raw.slice(0, match.index) + "---\n" + sanitizedBlock + "\n---" + raw.slice(match.index + match[0].length);
}

/** Parse frontmatter with automatic colon-in-value recovery and per-file error reporting. */
function parseMatter(raw, file) {
  try {
    return matter(raw);
  } catch (firstErr) {
    try {
      const sanitized = sanitizeFrontmatter(raw);
      const result = matter(sanitized);
      console.warn(`  ⚠  Auto-quoted YAML colon in: ${file}`);
      return result;
    } catch (secondErr) {
      console.warn(`  ✗  Skipping unparseable file: ${file}`);
      console.warn(`     ${secondErr.message.split("\n")[0]}`);
      return null;
    }
  }
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
    const parsed = parseMatter(raw, file);
    if (!parsed) continue;
    const { data, content } = parsed;
    const section = file.split(path.sep)[0];
    let slug =
      section === "blog"
        ? file.replace(/^blog\//, "").replace(/\.md$/, "")
        : path.basename(file, ".md");

    // Handle doc/ subdirectory in pages
    if (section === "pages" && file.includes("doc/")) {
      slug = `doc/${path.basename(file, ".md")}`;
    }

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
      if (normalizeStatus(data.status)) entry.status = normalizeStatus(data.status);
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
      if (normalizeStatus(data.status)) entry.status = normalizeStatus(data.status);
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

  // Separate docs from pages
  const docs = [];
  const regularPages = [];
  for (const page of pages) {
    if (page.slug.startsWith("doc/")) {
      docs.push(page);
    } else {
      regularPages.push(page);
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
    const parsed2 = parseMatter(raw, file);
    if (!parsed2) continue;
    const { data, content } = parsed2;
    const section = file.split(path.sep)[0];
    if (!shouldIncludeInSearch(section)) continue;
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
  write("pages.json", regularPages);
  write("docs.json", docs);
  write("tags.json", tags);
  write("categories.json", categories);
  write("search-index.json", searchIndex);

  // Sorted metadata arrays for pagination
  const sortFns = {
    latest: (a, b) => new Date(b.date) - new Date(a.date),
    oldest: (a, b) => new Date(a.date) - new Date(b.date),
    az: (a, b) => (a.title || "").localeCompare(b.title || ""),
    za: (a, b) => (b.title || "").localeCompare(a.title || ""),
  };
  for (const [variant, fn] of Object.entries(sortFns)) {
    write(`blog-sorted-${variant}.json`, [...posts].sort(fn));
    write(`portfolio-sorted-${variant}.json`, [...portfolioItems].sort(fn));
    write(`thoughts-sorted-${variant}.json`, [...thoughts].sort(fn));
  }
  write("blog-index.json", { totalItems: posts.length, defaultSort: "latest" });
  write("portfolio-index.json", { totalItems: portfolioItems.length, defaultSort: "latest" });
  write("thoughts-index.json", { totalItems: thoughts.length, defaultSort: "latest" });

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
  await generateGalleryCover(galleryItems);
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
    siteConfig,
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
      } else {
        // A post at any deeper level contributes its first child segment.
        // This handles arbitrary nesting, e.g. novels/book/chapters/Part I/ch1.md
        const prefix = d === "" ? "" : d + "/";
        if (!pd.startsWith(prefix) || pd === d) continue;
        const remainder = pd.slice(prefix.length);
        if (!remainder) continue;
        const firstSeg = remainder.split("/")[0];
        if (firstSeg) childDirs.add(firstSeg);
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
  siteConfig,
}) {
  const siteUrl = getSiteUrl(siteConfig);
  const adsenseConfig = parseAdsenseConfig(siteConfig);
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
  const indexableRoutes = routes.filter((route) => isIndexableRoute(route));

  writeWebFile("sitemap.xml", buildSitemapXml(siteUrl, indexableRoutes));
  writeWebFile("robots.txt", buildRobotsTxt(siteUrl));
  if (adsenseConfig && adsenseConfig.adsTxtLine) {
    writeWebFile("ads.txt", `${adsenseConfig.adsTxtLine}\n`);
  } else {
    const adsTxtPath = path.join(WEB_DIR, "ads.txt");
    if (fs.existsSync(adsTxtPath)) fs.unlinkSync(adsTxtPath);
  }
  await generateStaticRoutePages(routes, {
    siteUrl,
    siteConfig,
    posts,
    portfolioItems,
    galleryItems,
    thoughts,
    pages,
    tags,
    categories,
    blogDirs,
  });
  await generate404Page({ siteUrl, siteConfig });
  writeWebFile(".nojekyll", "");

  // Write CNAME if the site uses a custom domain (not *.github.io)
  const siteHost = new URL(siteUrl).hostname;
  if (!siteHost.endsWith(".github.io")) {
    writeWebFile("CNAME", siteHost);
    console.log(`  ✓ Generated CNAME (${siteHost})`);
  }

  console.log("  ✓ Generated sitemap.xml");
  console.log("  ✓ Generated robots.txt");
  if (adsenseConfig && adsenseConfig.adsTxtLine) {
    console.log("  ✓ Generated ads.txt");
  }
  console.log("  ✓ Generated 404.html");
  console.log(`  ✓ Generated route pages (${routes.length})`);
}

function getSiteUrl(siteConfig) {
  const configured =
    process.env.SITE_URL ||
    process.env.BASE_URL ||
    (siteConfig && siteConfig.site_url);
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
  const ssh = remote.match(/^git@github\.com[^:]*:([^/]+)\//i);
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
      // Add trailing slash to all non-root URLs to match the live site's redirect behavior
      const clean = route === "/" ? "" : (route.endsWith("/") ? route : route + "/");
      const priority = getSitemapPriority(route);
      return [
        "  <url>",
        `    <loc>${escapeXml(siteUrl + clean)}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <priority>${priority.toFixed(1)}</priority>`,
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

function buildRobotsTxt(siteUrl) {
  return [
    "# --- Content Signals ---",
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "",
    "# --- Default rules ---",
    "Allow: /",
    "",
    "# --- Block low-value / internal pages ---",
    "Disallow: /content/",
    "Disallow: /metadata/",
    "Disallow: /vendor/",
    "Disallow: /thoughts",
    "Disallow: /gallery",
    "Disallow: /404.html",
    "Disallow: /tags",
    "Disallow: /tag/",
    "Disallow: /categories",
    "Disallow: /category/",
    "Disallow: /blog/dir/",
    "",
    "# --- Block AI crawlers explicitly ---",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: ClaudeBot",
    "Disallow: /",
    "",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    "User-agent: CCBot",
    "Disallow: /",
    "",
    "User-agent: Bytespider",
    "Disallow: /",
    "",
    "User-agent: Amazonbot",
    "Disallow: /",
    "",
    "User-agent: meta-externalagent",
    "Disallow: /",
    "",
    "User-agent: Applebot-Extended",
    "Disallow: /",
    "",
    "User-agent: CloudflareBrowserRenderingCrawler",
    "Disallow: /",
    "",
    "# --- Sitemap ---",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
    "Crawl-delay: 5",
    "",
  ].join("\n");
}

function isIndexableRoute(route) {
  if (!route) return false;
  if (["/", "/blog", "/portfolio", "/profile", "/about"].includes(route)) {
    return true;
  }
  if (route.startsWith("/blog/post/")) return true;
  if (route.startsWith("/portfolio/")) return true;
  if (/^\/[^/]+$/.test(route) && !["/gallery", "/thoughts", "/tags", "/categories"].includes(route)) {
    return true;
  }
  return false;
}

function getSitemapPriority(route) {
  if (route === "/profile") return 1;
  if (route === "/") return 0.9;
  if (route.startsWith("/blog/post/") || route.startsWith("/portfolio/")) return 0.8;
  if (["/blog", "/portfolio", "/about"].includes(route)) return 0.7;
  if (/^\/[^/]+$/.test(route)) return 0.6;
  return 0.3;
}

function getAbsoluteRouteUrl(siteUrl, route) {
  return route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`;
}

function normalizeConfigAssetPath(assetPath) {
  if (!assetPath) return "";
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith("data:")) {
    return assetPath;
  }

  const normalized = String(assetPath).replace(/^\/+/, "");
  if (normalized.startsWith("content/")) return normalized;
  return `content/${normalized}`;
}

function resolveSiteAssetUrl(siteUrl, assetPath) {
  const normalized = normalizeConfigAssetPath(assetPath);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("data:")) {
    return normalized;
  }
  return getAbsoluteRouteUrl(siteUrl, `/${normalized}`);
}

function buildFallbackFaviconDataUri(palette) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.g1}"/><stop offset="100%" stop-color="${palette.g3}"/></linearGradient></defs><path d="M16 2L30 16L16 30L2 16Z" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildFallbackFaviconSvg(palette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${palette.g1}"/><stop offset="100%" stop-color="${palette.g3}"/></linearGradient></defs><path d="M32 4L60 32L32 60L4 32Z" fill="url(#g)"/></svg>`;
}

function getLocalAssetAbsolutePath(assetPath) {
  const normalized = normalizeConfigAssetPath(assetPath);
  if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith("data:")) {
    return "";
  }
  return path.join(WEB_DIR, normalized);
}

function buildRootFaviconRefs() {
  return {
    svg: "favicon.svg",
    png: "favicon.png",
    apple: "apple-touch-icon.png",
    manifest: "site.webmanifest",
  };
}

async function generateFaviconAssets(siteConfig) {
  const palette = getAccentPalette(siteConfig || {});
  const refs = buildRootFaviconRefs();
  const logoAbsolutePath = getLocalAssetAbsolutePath(siteConfig && siteConfig.logo);
  let faviconSvg = buildFallbackFaviconSvg(palette);

  if (logoAbsolutePath && fs.existsSync(logoAbsolutePath)) {
    const ext = path.extname(logoAbsolutePath).toLowerCase();
    if (ext === ".svg") {
      faviconSvg = fs
        .readFileSync(logoAbsolutePath, "utf-8")
        .replace(/currentColor/g, palette.accent);
    }
  }

  writeWebFile(refs.svg, faviconSvg);

  const pngSource = Buffer.from(faviconSvg);
  try {
    await sharp(pngSource).resize(48, 48).png().toFile(path.join(WEB_DIR, refs.png));
    await sharp(pngSource).resize(180, 180).png().toFile(path.join(WEB_DIR, refs.apple));
  } catch {
    if (logoAbsolutePath && fs.existsSync(logoAbsolutePath)) {
      await sharp(logoAbsolutePath).resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(WEB_DIR, refs.png));
      await sharp(logoAbsolutePath).resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(WEB_DIR, refs.apple));
    }
  }

  writeWebFile(
    refs.manifest,
    JSON.stringify(
      {
        name: (siteConfig && siteConfig.hero_title) || "Raksara",
        short_name: (siteConfig && siteConfig.hero_title) || "Raksara",
        icons: [
          { src: `/${refs.png}`, sizes: "48x48", type: "image/png" },
          { src: `/${refs.apple}`, sizes: "180x180", type: "image/png" },
          { src: `/${refs.svg}`, sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        theme_color: palette.accent,
        background_color: "#0b0d12",
        display: "standalone",
      },
      null,
      2,
    ),
  );

  console.log("  ✓ Generated favicon assets");
  await generateFaviconIco();
}

async function generateFaviconIco() {
  const faviconPngPath = path.join(WEB_DIR, "favicon.png");
  const faviconIcoPath = path.join(WEB_DIR, "favicon.ico");

  if (!fs.existsSync(faviconPngPath)) {
    return;
  }

  try {
    // Read PNG and convert to ICO with multiple sizes
    const pngBuffer = fs.readFileSync(faviconPngPath);
    
    // Create images array with different sizes for ICO file
    const img16 = await sharp(pngBuffer).resize(16, 16).raw().toBuffer();
    const img32 = await sharp(pngBuffer).resize(32, 32).raw().toBuffer();
    const img48 = await sharp(pngBuffer).resize(48, 48).raw().toBuffer();
    
    const images = [
      { width: 16, height: 16, data: img16 },
      { width: 32, height: 32, data: img32 },
      { width: 48, height: 48, data: img48 },
    ];
    
    const icoBuffer = imagesToIco(images);
    fs.writeFileSync(faviconIcoPath, icoBuffer);
    console.log("  ✓ Generated favicon.ico");
  } catch (error) {
    console.log("  ⚠ Failed to generate favicon.ico: ", error.message);
  }
}

function buildAccentCssVariables(palette) {
  return [
    `--accent:${palette.accent}`,
    `--accent-hover-dark:${palette.hoverDark}`,
    `--accent-hover-light:${palette.hoverLight}`,
    `--gradient-1:${palette.g1}`,
    `--gradient-2:${palette.g2}`,
    `--gradient-3:${palette.g3}`,
    `--accent-rgb:${palette.rgb}`,
  ].join(";");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOrInsertHeadTag(html, regex, replacement) {
  if (regex.test(html)) return html.replace(regex, replacement);
  return html.replace("</head>", `${replacement}</head>`);
}

function upsertMetaTag(html, attrName, attrValue, content) {
  const regex = new RegExp(`<meta[^>]+${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*>`, "i");
  return replaceOrInsertHeadTag(
    html,
    regex,
    `<meta ${attrName}="${attrValue}" content="${escapeHtml(content || "")}"/>`,
  );
}

function upsertLinkTag(html, relValue, attrs) {
  const regex = new RegExp(`<link[^>]+rel=["']${escapeRegExp(relValue)}["'][^>]*>`, "i");
  const attrString = Object.entries({ rel: relValue, ...attrs })
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(" ");
  return replaceOrInsertHeadTag(html, regex, `<link ${attrString}/>`);
}

function upsertScriptById(html, id, scriptBody) {
  const regex = new RegExp(`<script[^>]+id=["']${escapeRegExp(id)}["'][^>]*>[\\s\\S]*?<\\/script>`, "i");
  return replaceOrInsertHeadTag(
    html,
    regex,
    `<script id="${escapeHtml(id)}">${scriptBody}</script>`,
  );
}

function setHtmlInlineStyle(html, styleValue) {
  if (/<html[^>]*style="[^"]*"/i.test(html)) {
    return html.replace(/<html([^>]*)style="[^"]*"([^>]*)>/i, `<html$1style="${escapeHtml(styleValue)}"$2>`);
  }
  return html.replace(/<html([^>]*)>/i, `<html$1 style="${escapeHtml(styleValue)}">`);
}

function stripSvgPreamble(svgMarkup) {
  return String(svgMarkup || "")
    .replace(/<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/<!--[\s\S]*?-->\s*/g, "")
    .trim();
}

function buildInlineSvgMarkup(svgMarkup, { size, label, className } = {}) {
  const cleaned = stripSvgPreamble(svgMarkup);
  if (!cleaned) return "";

  return cleaned.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
    const sanitizedAttrs = attrs
      .replace(/\s(width|height|class|role|aria-label|aria-hidden|focusable)="[^"]*"/gi, "")
      .replace(/\s(width|height|class|role|aria-label|aria-hidden|focusable)='[^']*'/gi, "");
    const sizeAttrs = size ? ` width="${size}" height="${size}"` : "";
    const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
    const accessibilityAttr = label
      ? ` role="img" aria-label="${escapeHtml(label)}"`
      : ' aria-hidden="true"';
    return `<svg${sanitizedAttrs}${classAttr}${sizeAttrs}${accessibilityAttr} focusable="false">`;
  });
}

function buildLogoIconMarkup(siteConfig, siteName, options = {}) {
  const inline = Boolean(options.inline);
  const rootAbsolute = Boolean(options.rootAbsolute);
  const size = Number(options.size) || 18;
  const logoPath = normalizeConfigAssetPath(siteConfig && siteConfig.logo);
  const resolvedLogoPath = (logoPath && rootAbsolute && !/^https?:\/\//i.test(logoPath) && !logoPath.startsWith("data:"))
    ? `/${logoPath.replace(/^\/+/, "")}`
    : logoPath;
  const localLogoPath = getLocalAssetAbsolutePath(siteConfig && siteConfig.logo);

  if (inline && localLogoPath && fs.existsSync(localLogoPath) && path.extname(localLogoPath).toLowerCase() === ".svg") {
    return buildInlineSvgMarkup(fs.readFileSync(localLogoPath, "utf-8"), {
      size,
      label: siteName,
      className: "site-logo-inline",
    });
  }

  if (!logoPath || /^https?:\/\//i.test(logoPath) || logoPath.startsWith("data:")) {
    if (resolvedLogoPath) {
      return `<img src="${escapeHtml(resolvedLogoPath)}" alt="${escapeHtml(siteName)}" width="${size}" height="${size}" loading="eager" decoding="async" fetchpriority="high">`;
    }
    return "&#9670;";
  }
  return `<img src="${escapeHtml(resolvedLogoPath)}" alt="${escapeHtml(siteName)}" width="${size}" height="${size}" loading="eager" decoding="async" fetchpriority="high">`;
}

function build404IllustrationMarkup(palette) {
  const rawSvg = String.raw`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 500 500" xml:space="preserve"><g id="OBJECTS_copia"><g><path style="fill:#F5DF60;" d="M195.829,287.638h-13.112v23.048h-31.762v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.638z M150.955,263.612v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.937,8.091-6.271,11.728l-13.194,19.627H150.955z"/><path style="fill:#F5DF60;" d="M290.22,251.314c0,21.067-3.53,36.5-10.587,46.301c-7.058,9.8-17.864,14.699-32.413,14.699c-14.226,0-24.949-5.116-32.17-15.352c-7.222-10.233-10.832-25.451-10.832-45.649c0-21.175,3.529-36.702,10.588-46.585c7.057-9.881,17.863-14.822,32.414-14.822c14.171,0,24.88,5.145,32.128,15.433C286.596,215.63,290.22,230.953,290.22,251.314z M236.224,251.314c0,13.466,0.841,22.723,2.525,27.772c1.682,5.049,4.506,7.574,8.47,7.574c4.017,0,6.853-2.606,8.51-7.819c1.656-5.212,2.484-14.387,2.484-27.527c0-13.193-0.842-22.438-2.524-27.731c-1.684-5.294-4.508-7.94-8.47-7.94c-3.964,0-6.788,2.553-8.47,7.655C237.065,228.402,236.224,237.74,236.224,251.314z"/><path style="fill:#F5DF60;" d="M391.289,287.638h-13.111v23.048h-31.763v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.111V287.638z M346.415,263.612v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.938,8.091-6.271,11.728l-13.193,19.627H346.415z"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="55.75" y1="218.036" x2="103.887" y2="218.036"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="115.441" y1="218.036" x2="125.717" y2="218.036"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="47.033" y1="204.488" x2="133.208" y2="204.488"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="39.94" y1="204.488" x2="32.847" y2="204.488"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="47.033" y1="191.617" x2="75.643" y2="191.617"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="83.303" y1="191.617" x2="143.388" y2="191.617"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="396.009" y1="325.524" x2="447.521" y2="325.524"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="455.899" y1="325.524" x2="463.35" y2="325.524"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="406.296" y1="311.975" x2="473.803" y2="311.975"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="401.152" y1="311.975" x2="396.009" y2="311.975"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="396.009" y1="299.104" x2="427.041" y2="299.104"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="432.595" y1="299.104" x2="455.899" y2="299.104"/></g><g><path style="fill:none;stroke:#000000;stroke-width:3.2675;stroke-miterlimit:10;" d="M201.994,287.183h-13.112v23.048h-31.762v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.183z M157.119,263.157v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.937,8.091-6.271,11.728l-13.194,19.627H157.119z"/><path style="fill:none;stroke:#000000;stroke-width:3.2675;stroke-miterlimit:10;" d="M296.384,250.859c0,21.067-3.53,36.5-10.587,46.301c-7.058,9.8-17.864,14.699-32.413,14.699c-14.226,0-24.949-5.116-32.17-15.352c-7.222-10.233-10.832-25.451-10.832-45.649c0-21.175,3.529-36.702,10.587-46.585c7.057-9.881,17.863-14.822,32.414-14.822c14.171,0,24.88,5.145,32.128,15.433C292.761,215.175,296.384,230.499,296.384,250.859z M242.389,250.859c0,13.466,0.841,22.723,2.525,27.772c1.682,5.049,4.506,7.574,8.47,7.574c4.017,0,6.853-2.606,8.51-7.819c1.656-5.212,2.484-14.387,2.484-27.528c0-13.193-0.842-22.438-2.524-27.731c-1.684-5.294-4.508-7.94-8.47-7.94c-3.964,0-6.788,2.553-8.47,7.655C243.23,227.947,242.389,237.286,242.389,250.859z"/><path style="fill:none;stroke:#000000;stroke-width:3.2675;stroke-miterlimit:10;" d="M397.454,287.183h-13.112v23.048H352.58v-23.048h-47.481v-23.619l49.517-72.402h29.727v71.995h13.112V287.183z M352.58,263.157v-13.845c0-2.606,0.094-6.12,0.285-10.547c0.189-4.424,0.338-6.746,0.448-6.963h-0.896c-1.846,4.181-3.938,8.091-6.271,11.728l-13.193,19.627H352.58z"/></g><text transform="matrix(1 0 0 1 190.3823 362.4004)" style="font-family:'OpenSans-Extrabold'; font-size:37.1855px;">ERROR</text><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="418.489" y1="215.1" x2="418.489" y2="204.061"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="410.783" y1="218.292" x2="402.978" y2="210.486"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="407.592" y1="225.998" x2="396.553" y2="225.998"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="410.783" y1="233.703" x2="402.978" y2="241.509"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="418.489" y1="236.895" x2="418.489" y2="247.934"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="426.195" y1="233.703" x2="434.001" y2="241.509"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="429.387" y1="225.998" x2="440.426" y2="225.998"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="426.195" y1="218.292" x2="434.001" y2="210.486"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="72.261" y1="270.066" x2="72.261" y2="262.087"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="66.691" y1="272.374" x2="61.049" y2="266.732"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="64.384" y1="277.944" x2="56.405" y2="277.944"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="66.691" y1="283.514" x2="61.049" y2="289.156"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="72.261" y1="285.821" x2="72.261" y2="293.8"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="77.831" y1="283.514" x2="83.473" y2="289.156"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="80.138" y1="277.944" x2="88.118" y2="277.944"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="77.831" y1="272.374" x2="83.473" y2="266.732"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="288.183" y1="105.254" x2="288.183" y2="97.274"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="282.613" y1="107.561" x2="276.971" y2="101.919"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="280.306" y1="113.131" x2="272.327" y2="113.131"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="282.613" y1="118.701" x2="276.971" y2="124.343"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="288.183" y1="121.008" x2="288.183" y2="128.987"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="293.753" y1="118.701" x2="299.395" y2="124.343"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="296.06" y1="113.131" x2="304.039" y2="113.131"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="293.753" y1="107.561" x2="299.395" y2="101.919"/></g><rect x="111.874" y="326.894" style="fill:none;stroke:#000000;stroke-width:2.4187;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" width="273.761" height="43.098"/><rect x="111.874" y="386.271" style="fill:none;" width="275.126" height="30.529"/><polyline style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" points="133.208,172.198 133.208,137.669 312.701,137.669 312.701,214.389"/><polyline style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" points="249.436,113.131 249.436,156.361 368.464,156.361 368.464,176.029"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M137.491,176.481c0,2.366-1.918,4.283-4.283,4.283c-2.366,0-4.283-1.918-4.283-4.283c0-2.365,1.918-4.283,4.283-4.283C135.574,172.198,137.491,174.115,137.491,176.481z"/><circle style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" cx="249.436" cy="108.848" r="4.283"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M372.747,180.764c0,2.365-1.918,4.283-4.283,4.283c-2.366,0-4.283-1.918-4.283-4.283c0-2.366,1.918-4.283,4.283-4.283C370.829,176.481,372.747,178.399,372.747,180.764z"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M316.984,219.383c0,2.365-1.918,4.283-4.283,4.283s-4.283-1.918-4.283-4.283c0-2.366,1.918-4.283,4.283-4.283S316.984,217.018,316.984,219.383z"/><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="105.295" y1="305.164" x2="95.161" y2="315.298"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="95.161" y1="305.164" x2="105.295" y2="315.298"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="110.362" y1="158" x2="100.228" y2="168.135"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="100.228" y1="158" x2="110.362" y2="168.135"/></g><g><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="439.068" y1="272.876" x2="428.933" y2="283.011"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="428.933" y1="272.876" x2="439.068" y2="283.011"/></g><path style="fill:none;stroke:#000000;stroke-width:2.2614;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M151.47,100.161c-3.232,0-6.19,1.163-8.487,3.089c-2.346-7.062-8.994-12.16-16.843-12.16c-8.787,0-16.065,6.389-17.487,14.771c-0.926-0.265-1.901-0.416-2.913-0.416c-5.843,0-10.579,4.737-10.579,10.579c0,5.375,4.012,9.803,9.202,10.48v0.1h47.107c7.302,0,13.222-5.919,13.222-13.222C164.692,106.081,158.772,100.161,151.47,100.161z"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M396.605,167.417c2.348,0,4.497,0.845,6.166,2.244c1.704-5.13,6.534-8.834,12.236-8.834c6.384,0,11.671,4.642,12.704,10.731c0.673-0.193,1.381-0.302,2.116-0.302c4.245,0,7.686,3.441,7.686,7.686c0,3.905-2.914,7.122-6.685,7.613v0.072h-34.222c-5.305,0-9.605-4.301-9.605-9.605S391.3,167.417,396.605,167.417z"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M443.789,349.113c-1.969,0-3.771,0.709-5.171,1.882c-1.429-4.302-5.48-7.409-10.262-7.409c-5.354,0-9.788,3.893-10.654,9c-0.564-0.161-1.158-0.253-1.775-0.253c-3.56,0-6.446,2.886-6.446,6.446c0,3.275,2.444,5.973,5.607,6.385v0.061h28.7c4.449,0,8.056-3.606,8.056-8.055C451.844,352.72,448.238,349.113,443.789,349.113z"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" d="M54.253,332.114c2.348,0,4.497,0.845,6.166,2.244c1.704-5.13,6.534-8.834,12.236-8.834c6.384,0,11.671,4.642,12.704,10.731c0.673-0.193,1.381-0.302,2.116-0.302c4.245,0,7.686,3.441,7.686,7.686c0,3.905-2.914,7.122-6.685,7.613v0.072H54.253c-5.305,0-9.605-4.3-9.605-9.605C44.648,336.414,48.948,332.114,54.253,332.114z"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.2675,7.6242;" d="M164.692,93.818c0,0,60.44-49.277,142.56-26.575C393.515,91.09,410.783,152.6,410.783,152.6"/><path style="fill:none;stroke:#000000;stroke-width:2.0166;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.0467,7.1089;" d="M73.433,237.04c-23.431,3.634-35.21,53.363-8.854,73.104"/><path style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;stroke-dasharray:3.2675,7.6242;" d="M368.464,380.526c0,0,40.138,17.546,57.732-6.933"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="177.513" y1="180.764" x2="177.513" y2="155.418"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="171.395" y1="180.764" x2="171.395" y2="168.135"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="270.67" y1="186.628" x2="270.67" y2="168.091"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="263.72" y1="185.047" x2="263.72" y2="177.359"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="257.554" y1="185.047" x2="257.554" y2="172.198"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="183.394" y1="180.764" x2="183.394" y2="168.091"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="351.395" y1="184.292" x2="351.395" y2="178.622"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="345.277" y1="184.292" x2="345.277" y2="170.482"/><line style="fill:none;stroke:#000000;stroke-width:2.1628;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;" x1="357.276" y1="184.292" x2="357.276" y2="174.428"/></g></svg>`;

  return buildInlineSvgMarkup(
    rawSvg
      .replace(/#F5DF60/gi, palette.accent)
      .replace(/#000000/gi, palette.hoverDark)
      .replace(
        /font-family:'OpenSans-Extrabold'; font-size:37\.1855px;/i,
        `font-family:Inter,Arial,sans-serif;font-weight:800;font-size:37.1855px;fill:${palette.hoverDark};`,
      ),
    { className: "not-found-illustration-art" },
  );
}

function humanizeSlug(slug) {
  return String(slug || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPageEntry(pages, slug) {
  return (pages || []).find((page) => page.slug === slug) || null;
}

function getRouteMeta(route, context) {
  const { siteUrl, siteConfig, posts, portfolioItems, galleryItems, thoughts, pages, tags, categories, blogDirs } = context;
  const siteName = (siteConfig && siteConfig.hero_title) || "Raksara";
  const siteDescription =
    (siteConfig && siteConfig.hero_subtitle) ||
    "A place where ideas, knowledge, and engineering thoughts are recorded.";
  const routeUrl = getAbsoluteRouteUrl(siteUrl, route);
  const defaultImage = resolveSiteAssetUrl(siteUrl, (siteConfig && (siteConfig.og_image || siteConfig.logo)) || "");
  const parts = route.split("/").filter(Boolean);
  const page = parts.length === 1 ? getPageEntry(pages, parts[0]) : null;

  const meta = {
    title: siteName,
    description: siteDescription,
    image: defaultImage,
    type: "website",
    author: (siteConfig && siteConfig.author) || "",
    keywords: [],
    robots: isIndexableRoute(route) ? "index, follow" : "noindex, nofollow",
    url: routeUrl,
  };

  if (route === "/") return meta;
  if (route === "/blog") {
    return { ...meta, title: `Blog — ${siteName}`, description: `${posts.length} post${posts.length === 1 ? "" : "s"} and writing archives.` };
  }
  if (route.startsWith("/blog/post/")) {
    const slug = decodeURIComponent(route.replace("/blog/post/", ""));
    const post = (posts || []).find((entry) => entry.slug === slug);
    if (post) {
      return {
        ...meta,
        title: `${post.title} — ${siteName}`,
        description: post.summary || siteDescription,
        image: resolveSiteAssetUrl(siteUrl, post.cover || defaultImage),
        type: "article",
        keywords: post.tags || [],
      };
    }
  }
  if (route.startsWith("/blog/dir/")) {
    const dirPath = decodeURIComponent(route.replace("/blog/dir/", ""));
    const dir = blogDirs[dirPath] || { posts: [], subdirs: [] };
    const label = humanizeSlug(dirPath.split("/").pop() || "blog");
    return {
      ...meta,
      title: `${label} — ${siteName}`,
      description: `${dir.posts.length} post${dir.posts.length === 1 ? "" : "s"} in this directory.`,
      robots: "noindex, nofollow",
    };
  }
  if (route === "/portfolio") {
    return { ...meta, title: `Portfolio — ${siteName}`, description: `${portfolioItems.length} project${portfolioItems.length === 1 ? "" : "s"} and case studies.` };
  }
  if (route.startsWith("/portfolio/")) {
    const slug = decodeURIComponent(route.replace("/portfolio/", ""));
    const item = (portfolioItems || []).find((entry) => entry.slug === slug);
    if (item) {
      return {
        ...meta,
        title: `${item.title} — ${siteName}`,
        description: item.summary || siteDescription,
        image: resolveSiteAssetUrl(siteUrl, item.cover || defaultImage),
        type: "article",
        keywords: item.tags || [],
      };
    }
  }
  if (route === "/gallery") {
    return {
      ...meta,
      title: `Gallery — ${siteName}`,
      description: `${galleryItems.length} visual entries and sketches.`,
      image: resolveSiteAssetUrl(siteUrl, galleryItems[0] && galleryItems[0].image ? galleryItems[0].image : defaultImage),
      robots: "noindex, nofollow",
    };
  }
  if (route.startsWith("/gallery/")) {
    const index = Number.parseInt(route.replace("/gallery/", ""), 10);
    const item = Number.isNaN(index) ? null : galleryItems[index];
    return {
      ...meta,
      title: `${(item && item.title) || "Gallery"} — ${siteName}`,
      description: (item && (item.caption || item.description)) || siteDescription,
      image: resolveSiteAssetUrl(siteUrl, item && item.image ? item.image : defaultImage),
      robots: "noindex, nofollow",
    };
  }
  if (route === "/thoughts") {
    return { ...meta, title: `Shower Thoughts — ${siteName}`, description: `${thoughts.length} short-form notes and fragments.`, robots: "noindex, nofollow" };
  }
  if (route === "/tags") {
    return { ...meta, title: `Tags — ${siteName}`, description: `${Object.keys(tags || {}).length} tags.`, robots: "noindex, nofollow" };
  }
  if (route.startsWith("/tag/")) {
    const tag = decodeURIComponent(route.replace("/tag/", ""));
    return { ...meta, title: `Tag: ${tag} — ${siteName}`, description: `Tagged archive for ${tag}.`, robots: "noindex, nofollow", keywords: [tag] };
  }
  if (route === "/categories") {
    return { ...meta, title: `Categories — ${siteName}`, description: `${Object.keys(categories || {}).length} categories.`, robots: "noindex, nofollow" };
  }
  if (route.startsWith("/category/")) {
    const category = decodeURIComponent(route.replace("/category/", ""));
    return { ...meta, title: `Category: ${category} — ${siteName}`, description: `Category archive for ${category}.`, robots: "noindex, nofollow", keywords: [category] };
  }
  if (page) {
    const description = page.summary || page.description || siteDescription;
    return {
      ...meta,
      title: page.title ? `${page.title} — ${siteName}` : siteName,
      description,
    };
  }

  return { ...meta, title: `${humanizeSlug(parts[0] || siteName)} — ${siteName}`, robots: "noindex, nofollow" };
}

function extractCriticalCssSync() {
  try {
    const cssPath = path.join(WEB_DIR, "styles.css");
    if (!fs.existsSync(cssPath)) return "";
    const css = fs.readFileSync(cssPath, "utf-8");
    const marker = "/* END CRITICAL CSS */";
    const markerIdx = css.indexOf(marker);
    const criticalRaw = markerIdx !== -1 ? css.slice(0, markerIdx) : "";
    if (!criticalRaw.trim()) return "";
    // Minify inline: collapse whitespace, strip comments (keep /* END CRITICAL CSS */ already excluded)
    return criticalRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")     // strip block comments
      .replace(/\s{2,}/g, " ")              // collapse whitespace
      .replace(/\s*([{};:,>+~])\s*/g, "$1") // remove space around punctuation
      .replace(/;\s*}/g, "}")               // remove trailing semicolons
      .trim();
  } catch {
    return "";
  }
}

function buildShellHtml(srcHtml, { baseHref, route, context }) {
  const siteConfig = context.siteConfig || {};
  const adsenseConfig = parseAdsenseConfig(siteConfig);
  const routeMeta = getRouteMeta(route, context);
  const palette = getAccentPalette(siteConfig);
  const siteName = (siteConfig && siteConfig.hero_title) || "Raksara";
  const configScript = `window.__RAKSARA_SITE_CONFIG__ = ${JSON.stringify(siteConfig).replace(/</g, "\\u003c")};`;
  const keywords = Array.isArray(routeMeta.keywords)
    ? routeMeta.keywords.join(", ")
    : (routeMeta.keywords || "");
  const faviconRefs = buildRootFaviconRefs();
  const twitterCard = routeMeta.image ? "summary_large_image" : "summary";
  const logoMarkup = buildLogoIconMarkup(siteConfig, siteName);

  let html = injectOrReplaceBaseHref(srcHtml, baseHref);
  html = html
    .replace(/href=["']styles\.min\.css(?:\?[^"']*)?["']/g, `href="styles.min.css?v=${BUILD_CACHE_BUST}"`)
    .replace(/src=["']app\.min\.js(?:\?[^"']*)?["']/g, `src="app.min.js?v=${BUILD_CACHE_BUST}"`);
  html = html.replace(/<script[^>]+pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>/gi, "");
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(routeMeta.title)}</title>`);
  html = upsertMetaTag(html, "name", "description", routeMeta.description);
  html = upsertMetaTag(html, "name", "author", routeMeta.author || "");
  html = upsertMetaTag(html, "name", "keywords", keywords);
  html = upsertMetaTag(html, "name", "robots", routeMeta.robots);
  html = upsertMetaTag(html, "name", "theme-color", palette.accent);
  html = upsertMetaTag(html, "property", "og:site_name", siteName);
  html = upsertMetaTag(html, "property", "og:title", routeMeta.title);
  html = upsertMetaTag(html, "property", "og:description", routeMeta.description);
  html = upsertMetaTag(html, "property", "og:type", routeMeta.type || "website");
  html = upsertMetaTag(html, "property", "og:url", routeMeta.url);
  html = upsertMetaTag(html, "property", "og:image", routeMeta.image || "");
  html = upsertMetaTag(html, "name", "twitter:card", twitterCard);
  html = upsertMetaTag(html, "name", "twitter:title", routeMeta.title);
  html = upsertMetaTag(html, "name", "twitter:description", routeMeta.description);
  html = upsertMetaTag(html, "name", "twitter:image", routeMeta.image || "");
  if (adsenseConfig && adsenseConfig.accountId) {
    html = upsertMetaTag(html, "name", "google-adsense-account", adsenseConfig.accountId);
  }
  html = upsertLinkTag(html, "canonical", { href: routeMeta.url });
  html = upsertLinkTag(html, "icon", { type: "image/svg+xml", href: faviconRefs.svg });
  html = replaceOrInsertHeadTag(html, /<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i, `<link rel="apple-touch-icon" sizes="180x180" href="${faviconRefs.apple}"/>`);
  html = replaceOrInsertHeadTag(html, /<link[^>]+rel=["']manifest["'][^>]*>/i, `<link rel="manifest" href="${faviconRefs.manifest}"/>`);
  html = replaceOrInsertHeadTag(html, /<link[^>]+rel=["']icon["'][^>]+sizes=["']48x48["'][^>]*>/i, `<link rel="icon" type="image/png" sizes="48x48" href="${faviconRefs.png}"/>`);
  html = upsertScriptById(html, "raksara-site-config", configScript);
  html = setHtmlInlineStyle(html, buildAccentCssVariables(palette));
  html = html.replace(/<span class="logo-text">[\s\S]*?<\/span>/g, `<span class="logo-text">${escapeHtml(siteName)}</span>`);
  html = html.replace(/<span class="logo-icon">[\s\S]*?<\/span>/g, `<span class="logo-icon">${logoMarkup}</span>`);
  // Inline critical CSS extracted from styles.css
  const criticalCss = extractCriticalCssSync();
  if (criticalCss) {
    html = html.replace('<style id="raksara-critical-css"></style>', `<style id="raksara-critical-css">${criticalCss}</style>`);
  }
  return html;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseAdsenseConfig(siteConfig) {
  if (!siteConfig || typeof siteConfig !== "object") return null;

  const raw = siteConfig.adsense;
  if (!raw) return null;

  let parts = [];
  if (typeof raw === "string") {
    parts = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    parts = raw.map((entry) => String(entry).trim()).filter(Boolean);
  } else if (typeof raw === "object") {
    const domain = raw.domain || raw.network || raw.host || "";
    const publisher = raw.publisher || raw.pub || raw.account || raw.publisher_id || raw.publisherId || "";
    const relationship = raw.relationship || raw.type || raw.account_type || "";
    const cert = raw.cert || raw.cert_id || raw.certification || raw.caid || "";
    parts = [domain, publisher, relationship, cert].map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (parts.length < 2) return null;

  const domain = parts[0];
  const publisher = parts[1];
  const relationship = (parts[2] || "DIRECT").toUpperCase();
  const cert = parts[3] || "";
  const accountMatch = publisher.match(/pub-\d+/i);
  const accountId = accountMatch ? accountMatch[0] : "";

  return {
    accountId,
    adsTxtLine: [domain, publisher, relationship, cert].filter(Boolean).join(", "),
  };
}

async function generateStaticRoutePages(routes, context) {
  const srcIndexPath = path.join(WEB_DIR, "index.html");
  if (!fs.existsSync(srcIndexPath)) return;
  const srcHtml = fs.readFileSync(srcIndexPath, "utf-8");

  for (const route of routes) {
    if (route === "/") continue;
    const routePath = route.replace(/^\/+/, "");
    const depth = routePath.split("/").filter(Boolean).length;
    const baseHref = `${"../".repeat(depth)}` || "./";
    const htmlWithBase = await minifyHtmlDocument(
      buildShellHtml(srcHtml, { baseHref, route, context }),
    );
    const outDir = path.join(WEB_DIR, routePath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), htmlWithBase);
  }

  // Keep root index explicitly base-aware for consistent relative loading.
  fs.writeFileSync(
    path.join(WEB_DIR, "index.html"),
    await minifyHtmlDocument(buildShellHtml(srcHtml, { baseHref: "./", route: "/", context })),
  );
}

async function generate404Page({ siteUrl, siteConfig }) {
  const siteName = (siteConfig && siteConfig.hero_title) || "Raksara";
  const palette = getAccentPalette(siteConfig);
  const adsenseConfig = parseAdsenseConfig(siteConfig);
  const homeUrl = "/";
  const themeBootstrapScript = `(()=>{try{const saved=localStorage.getItem("raksara-theme");const system=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",saved||system);}catch{document.documentElement.setAttribute("data-theme","dark");}})();`;
  const faviconRefs = {
    svg: "/favicon.svg",
    png: "/favicon.png",
    apple: "/apple-touch-icon.png",
    manifest: "/site.webmanifest",
    css: "/styles.min.css",
  };
  const logoMarkup = buildLogoIconMarkup(siteConfig || {}, siteName, { inline: true, size: 24 });
  const illustrationMarkup = build404IllustrationMarkup(palette);
  const html = `<!doctype html>
<html lang="en" data-theme="dark" style="${escapeHtml(buildAccentCssVariables(palette))}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Page Not Found — ${escapeHtml(siteName)}</title>
  <meta name="description" content="The page you requested could not be found."/>
  <meta name="robots" content="noindex, nofollow"/>
  <meta name="theme-color" content="${escapeHtml(palette.accent)}"/>
  ${adsenseConfig && adsenseConfig.accountId ? `<meta name="google-adsense-account" content="${escapeHtml(adsenseConfig.accountId)}"/>` : ""}
  <link rel="icon" type="image/svg+xml" href="${faviconRefs.svg}"/>
  <link rel="icon" type="image/png" sizes="48x48" href="${faviconRefs.png}"/>
  <link rel="apple-touch-icon" sizes="180x180" href="${faviconRefs.apple}"/>
  <link rel="manifest" href="${faviconRefs.manifest}"/>
  <script>${themeBootstrapScript}</script>
  <link rel="stylesheet" href="${faviconRefs.css}"/>
  <style>
    html,body{height:100%;overflow:hidden}
    body{margin:0;min-height:100svh;display:grid;place-items:center;padding:32px;box-sizing:border-box;color:var(--text-primary);background:var(--bg-base)}
    .not-found-shell{width:min(680px,100%);padding:40px;border:1px solid var(--border-color);border-radius:28px;background:var(--bg-card);box-shadow:0 24px 80px var(--shadow-color);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px)}
    .not-found-illustration{width:min(320px,72vw);margin:0 auto 28px}
    .not-found-illustration-art{display:block;width:100%;height:auto}
    .not-found-brand{display:flex;align-items:center;gap:12px;margin-bottom:18px;font-weight:700}
    .not-found-brand .logo-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;color:var(--accent)}
    .not-found-brand .logo-icon img,.not-found-brand .logo-icon svg{display:block;width:24px;height:24px}
    .not-found-shell h1{margin:0 0 12px;font-size:clamp(2rem,5vw,3.2rem);line-height:1.05}
    .not-found-shell p{margin:0 0 24px;color:var(--text-muted);font-size:1.05rem}
    .not-found-actions{display:flex;gap:12px;flex-wrap:wrap}
    .not-found-actions a{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600}
    .not-found-home{background:var(--accent);color:#fff}
    .not-found-back{border:1px solid var(--border-color);color:var(--text-primary);background:transparent}
    [data-theme="light"] .not-found-shell{background:var(--bg-glass-heavy)}
    @media (max-width:640px){.not-found-shell{padding:28px}.not-found-illustration{width:min(260px,76vw)}}
  </style>
</head>
<body>
  <div class="bg-gradient"></div>
  <div class="bg-noise"></div>
  <main class="not-found-shell">
    <div class="not-found-brand"><span class="logo-icon">${logoMarkup}</span><span>${escapeHtml(siteName)}</span></div>
    <div class="not-found-illustration">${illustrationMarkup}</div>
    <h1>That page does not exist.</h1>
    <p>The requested URL could not be resolved. Return to the main site or go back to the previous page.</p>
    <div class="not-found-actions">
      <a class="not-found-home" href="${escapeHtml(homeUrl)}">Go home</a>
      <a class="not-found-back" href="javascript:history.back()">Go back</a>
    </div>
  </main>
</body>
</html>`;
  writeWebFile("404.html", await minifyHtmlDocument(html));
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

  let galleryHtml;
  const galleryCoverPath = path.join(WEB_DIR, "content", "assets", "images", "gallery-cover.webp");
  if (fs.existsSync(galleryCoverPath)) {
    const stackSrc = "content/assets/images/gallery-cover.webp";
    galleryHtml = `
      <div class="gallery-window" role="button" tabindex="0" onclick="window.location.hash='/gallery'" onkeydown="if(event.key==='Enter')window.location.hash='/gallery'">
        <div class="gallery-window-chrome">
          <div class="gallery-window-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="gallery-window-title">Gallery</div>
        </div>
        <div class="gallery-window-body">
          <div class="gallery-stack">
            <div class="gallery-stack-card layer-1 is-loading"><img src="${stackSrc}" alt="Gallery preview 1" loading="lazy" decoding="async"></div>
            <div class="gallery-stack-card layer-2 is-loading"><img src="${stackSrc}" alt="Gallery preview 2" loading="lazy" decoding="async"></div>
            <div class="gallery-stack-card layer-3 is-loading"><img src="${stackSrc}" alt="Gallery preview 3" loading="lazy" decoding="async"></div>
          </div>
        </div>
      </div>`;
  } else {
    const stackSources = gallery
      .slice(0, 3)
      .map((g) => {
        const images = g.images && g.images.length > 0 ? g.images : g.image ? [{ src: g.image }] : [];
        return images.length ? resolvePath(images[0].src) : "";
      })
      .filter(Boolean);
    if (stackSources.length) {
      while (stackSources.length < 3) stackSources.push(stackSources[stackSources.length - 1]);
      galleryHtml = `
      <div class="gallery-window" role="button" tabindex="0" onclick="window.location.hash='/gallery'" onkeydown="if(event.key==='Enter')window.location.hash='/gallery'">
        <div class="gallery-window-chrome">
          <div class="gallery-window-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="gallery-window-title">Gallery</div>
        </div>
        <div class="gallery-window-body">
          <div class="gallery-stack">
            <div class="gallery-stack-card layer-1 is-loading"><img ${buildResponsiveImageAttrsPrerender(stackSources[0], { alt: "Gallery preview 1", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" }, imageManifest)}></div>
            <div class="gallery-stack-card layer-2 is-loading"><img ${buildResponsiveImageAttrsPrerender(stackSources[1], { alt: "Gallery preview 2", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" }, imageManifest)}></div>
            <div class="gallery-stack-card layer-3 is-loading"><img ${buildResponsiveImageAttrsPrerender(stackSources[2], { alt: "Gallery preview 3", loading: "lazy", sizes: "(max-width: 768px) calc(100vw - 48px), 520px" }, imageManifest)}></div>
          </div>
        </div>
      </div>`;
    } else {
      galleryHtml = "";
    }
  }

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

      <div class="home-section">
        <div class="home-section-header"><h2>Projects</h2><a href="#/portfolio">View all →</a></div>
        <div class="portfolio-grid">${portfolioHtml || '<div class="empty-state"><p>No projects yet.</p></div>'}</div>
      </div>

      ${
        galleryHtml
          ? `<div class="home-section">
        ${galleryHtml}
      </div>`
          : ""
      }

      ${
        thoughtsHtml
          ? `<div class="home-section">
        <div class="home-section-header"><h2>Shower Thoughts</h2><a href="#/thoughts">View all →</a></div>
        <div class="thoughts-list">${thoughtsHtml}</div>
      </div>`
          : ""
      }`;
}

async function generateGalleryCover(galleryItems) {
  const outputPath = path.join(WEB_DIR, "content", "assets", "images", "gallery-cover.webp");
  const candidates = [];
  for (const g of galleryItems) {
    if (candidates.length >= 4) break;
    const imgs = g.images && g.images.length > 0 ? g.images : g.image ? [{ src: g.image }] : [];
    if (!imgs.length) continue;
    const src = imgs[0].src || imgs[0];
    if (!src || src.startsWith("http://") || src.startsWith("https://")) continue;
    const absPath = path.join(WEB_DIR, resolvePath(src));
    if (fs.existsSync(absPath)) candidates.push(absPath);
  }
  if (!candidates.length) return;
  try {
    const size = 280;
    const cells = await Promise.all(
      candidates.map((p) => sharp(p).resize(size, size, { fit: "cover", position: "centre" }).toBuffer()),
    );
    while (cells.length < 4) cells.push(cells[cells.length - 1]);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: { r: 18, g: 21, b: 26 } } })
      .composite([
        { input: cells[0], top: 0,    left: 0 },
        { input: cells[1], top: 0,    left: size },
        { input: cells[2], top: size, left: 0 },
        { input: cells[3], top: size, left: size },
      ])
      .webp({ quality: 62, effort: 6 })
      .toFile(outputPath);
    console.log("  ✓ Generated gallery-cover.webp");
  } catch (err) {
    console.log("  ⚠ Failed to generate gallery cover:", err.message);
  }
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
  console.log(`Using content dir: ${CONTENT_DIR}`);
  try {
    await buildMetadata();
    const configPath = path.join(METADATA_DIR, "config.json");
    const siteConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
      : { color: "purple" };
    await generateFaviconAssets(siteConfig);
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
