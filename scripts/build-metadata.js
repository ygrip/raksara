const fg = require("fast-glob");
const matter = require("gray-matter");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const yaml = require("js-yaml");
const MiniSearch = require("minisearch");

const REPO_ROOT = path.join(__dirname, "..");
const LOCAL_CONTENT_LINK = path.join(REPO_ROOT, "content");
const LOCAL_CONTENT_SOURCE = path.resolve(REPO_ROOT, "..", "raksara-content");
let CONTENT_DIR = "";
const METADATA_DIR = path.join(__dirname, "..", "metadata");
const WEB_DIR = path.join(__dirname, "..", "web");

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
  generateSeoArtifacts({
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
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
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

function generateSeoArtifacts({
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
  generateStaticRoutePages(routes);

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

function generateStaticRoutePages(routes) {
  const srcIndexPath = path.join(WEB_DIR, "index.html");
  if (!fs.existsSync(srcIndexPath)) return;
  const srcHtml = fs.readFileSync(srcIndexPath, "utf-8");

  for (const route of routes) {
    if (route === "/") continue;
    const routePath = route.replace(/^\/+/, "");
    const depth = routePath.split("/").filter(Boolean).length;
    const baseHref = `${"../".repeat(depth)}` || "./";
    const htmlWithBase = injectOrReplaceBaseHref(srcHtml, baseHref);
    const outDir = path.join(WEB_DIR, routePath);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), htmlWithBase);
  }

  // Keep root index explicitly base-aware for consistent relative loading.
  fs.writeFileSync(
    path.join(WEB_DIR, "index.html"),
    injectOrReplaceBaseHref(srcHtml, "./"),
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

function minifyCSS() {
  try {
    const cssPath = path.join(WEB_DIR, "styles.css");
    const minCssPath = path.join(WEB_DIR, "styles.min.css");
    
    if (!fs.existsSync(cssPath)) {
      console.log("  ⚠ styles.css not found, skipping CSS minification");
      return;
    }

    const css = fs.readFileSync(cssPath, "utf-8");

    let minified = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+{/g, "{")
      .replace(/{\s+/g, "{")
      .replace(/\s+}/g, "}")
      .replace(/,\s+/g, ",")
      .replace(/\s+:/g, ":")
      .replace(/:\s+/g, ":")
      .replace(/\s+;/g, ";")
      .replace(/;\s+/g, ";")
      .trim();

    fs.writeFileSync(minCssPath, minified, "utf-8");

    const originalSize = css.length;
    const minifiedSize = minified.length;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`  ✓ CSS minified: ${(originalSize/1024).toFixed(1)} KB → ${(minifiedSize/1024).toFixed(1)} KB (${savings}% savings)`);
  } catch (err) {
    console.error("  ✗ CSS minification failed:", err.message);
  }
}

async function runBuild() {
  const cleanupSymlink = setupLocalContentSymlink();
  CONTENT_DIR = resolveContentDir();
  try {
    await buildMetadata();
    minifyCSS();
  } finally {
    cleanupSymlink();
  }
}

runBuild().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
