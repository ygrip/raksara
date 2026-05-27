const fg = require("fast-glob");
const matter = require("gray-matter");
const { validateFrontmatter } = require("./schemas");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const yaml = require("js-yaml");
const MiniSearch = require("minisearch");
const sharp = require("sharp");
const terser = require("terser");
const { rollup } = require("rollup");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const { imagesToIco } = require("png-to-ico");
const { generateOgImages, generateProfileOgImage } = require('./og-images');

const REPO_ROOT = path.join(__dirname, "..");
const LOCAL_CONTENT_LINK = path.join(REPO_ROOT, "content");
const LOCAL_CONTENT_SOURCE = path.resolve(REPO_ROOT, "..", "raksara-content");
let CONTENT_DIR = "";
const METADATA_DIR = path.join(__dirname, "..", "metadata");
const SVELTEKIT_DIR = path.join(REPO_ROOT, "sveltekit");
const SVELTEKIT_STATIC_DIR = path.join(SVELTEKIT_DIR, "static");
const WEB_DIR = SVELTEKIT_STATIC_DIR;
const RESPONSIVE_DIR_NAME = ".raksara-responsive";
const RESPONSIVE_WIDTHS = [320, 480, 640, 960, 1280, 1600];
const COLOR_TONES = {
  purple: { accent: "#6366f1", hoverDark: "#818cf8", hoverLight: "#4f46e5", g1: "#6366f1", g2: "#8b5cf6", g3: "#a855f7", rgb: "99,102,241" },
  blue: { accent: "#3b82f6", hoverDark: "#60a5fa", hoverLight: "#2563eb", g1: "#3b82f6", g2: "#06b6d4", g3: "#0ea5e9", rgb: "59,130,246" },
  red: { accent: "#ef4444", hoverDark: "#f87171", hoverLight: "#dc2626", g1: "#ef4444", g2: "#f43f5e", g3: "#ec4899", rgb: "239,68,68" },
  yellow: { accent: "#eab308", hoverDark: "#facc15", hoverLight: "#ca8a04", g1: "#eab308", g2: "#f59e0b", g3: "#f97316", rgb: "234,179,8" },
  green: { accent: "#22c55e", hoverDark: "#4ade80", hoverLight: "#16a34a", g1: "#22c55e", g2: "#10b981", g3: "#14b8a6", rgb: "34,197,94" },
  orange: { accent: "#f97316", hoverDark: "#fb923c", hoverLight: "#ea580c", g1: "#f97316", g2: "#fb923c", g3: "#fbbf24", rgb: "249,115,22" },
};
const STATUS_ALIASES = {
  complete: "completed",
};
const VALID_STATUSES = new Set(["draft", "ongoing", "completed"]);

fs.mkdirSync(METADATA_DIR, { recursive: true });

function resolveContentDir() {
  const explicit = process.env.CONTENT_DIR && path.resolve(REPO_ROOT, process.env.CONTENT_DIR);
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = [
    LOCAL_CONTENT_LINK,
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
  const canonical = STATUS_ALIASES[normalized] || normalized;
  return VALID_STATUSES.has(canonical) ? canonical : "";
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
    const { data: rawData, content } = parsed;
    const section = file.split(path.sep)[0];
    const strictMode = process.argv.includes("--strict");
    const data = validateFrontmatter(section, rawData, file, strictMode);
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
  if (siteConfig.admin && typeof siteConfig.admin === "object") {
    const { enabled, workerUrl, allowedAuthors, auth, content } = siteConfig.admin;
    siteConfig.admin = {
      enabled,
      workerUrl,
      auth:
        auth && typeof auth === "object"
          ? {
              provider: auth.provider === "github" ? "github" : "github",
              requireTurnstile: auth.requireTurnstile === true,
            }
          : undefined,
      allowedAuthors: Array.isArray(allowedAuthors)
        ? allowedAuthors.map((author) => ({
            githubUsername: author?.githubUsername,
            displayName: author?.displayName,
            role: author?.role,
          }))
        : [],
      content,
    };
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

  // --- OG Image generation ---
  // Hoist enriched arrays so prerender() and generateSeoArtifacts() below can use them.
  let enrichedPosts = posts;
  let enrichedPortfolio = portfolioItems;
  let enrichedGallery = galleryItems;
  let enrichedThoughts = thoughts;

  {
    // Full site URL (with protocol) for making OG image paths absolute.
    // WhatsApp / LinkedIn / Twitter all require absolute https:// URLs.
    const ogSiteRoot = String((siteConfig.site_url || siteConfig.url) || '').replace(/\/+$/, '');
    // Hostname-only version used inside generated SVG images
    const ogSiteUrl = ogSiteRoot.replace(/^https?:\/\//, '');
    const ogSiteName = String((siteConfig.hero_title || siteConfig.title) || 'Raksara');
    const ogAccentPalette = getAccentPalette(siteConfig);
    const ogAccentColor = (ogAccentPalette && (ogAccentPalette.accent || Object.values(ogAccentPalette)[0])) || '#6366f1';

    // ── gallery and thoughts are excluded from per-entry OG generation ──────
    // Those detail pages are not crawled by social bots (no public URL in sitemaps),
    // so spending build time on per-entry images is wasteful.  They receive the
    // shared type-level default image instead.
    const ogEntries = [
      ...posts.map(p => ({ type: 'blog', subtype: p.type || 'article', slug: p.slug, coverPath: p.cover || null })),
      ...portfolioItems.map(p => ({ type: 'portfolio', subtype: 'portfolio', slug: p.slug, coverPath: p.cover || null })),
      // gallery and thoughts: handled separately with default images below
    ];

    let ogResults = new Map();
    try {
      console.log(`[og] Generating OG images for ${ogEntries.length} entries (gallery/thoughts use shared defaults)...`);
      ogResults = await generateOgImages({
        webDir: WEB_DIR,
        entries: ogEntries,
        siteInfo: { siteName: ogSiteName, siteUrl: ogSiteUrl, accentColor: ogAccentColor },
      });
      console.log(`[og] OG image generation complete.`);
    } catch (err) {
      console.warn('[og] OG image generation failed (non-fatal):', err.message);
    }

    // Enrich entries with ogImage paths (absolute URLs for social sharing)
    function toAbsoluteOg(og) {
      if (!og || !ogSiteRoot) return og;
      return {
        landscape: og.landscape ? `${ogSiteRoot}${og.landscape}` : og.landscape,
        portrait: og.portrait ? `${ogSiteRoot}${og.portrait}` : og.portrait,
      };
    }
    function enrichWithOg(items, type) {
      return items.map(item => {
        const key = `${type}/${item.slug}`;
        const og = toAbsoluteOg(ogResults.get(key));
        if (!og) return item;
        return { ...item, ogImage: og };
      });
    }
    /** Point every item in a collection at the shared type-level default OG image. */
    function enrichWithDefaultOg(items, type) {
      if (!ogSiteRoot) return items;
      const og = {
        landscape: `${ogSiteRoot}/og/defaults/${type}-landscape.jpg`,
        portrait:  `${ogSiteRoot}/og/defaults/${type}-portrait.jpg`,
      };
      return items.map(item => ({ ...item, ogImage: og }));
    }

    enrichedPosts = enrichWithOg(posts, 'blog');
    enrichedPortfolio = enrichWithOg(portfolioItems, 'portfolio');
    // gallery and thoughts: shared default — no per-entry image
    enrichedGallery  = enrichWithDefaultOg(galleryItems, 'gallery');
    enrichedThoughts = enrichWithDefaultOg(thoughts, 'thoughts');

    // Re-write the JSON files with ogImage data included
    write("posts.json", enrichedPosts);
    write("portfolio.json", enrichedPortfolio);
    write("gallery.json", enrichedGallery);
    write("thoughts.json", enrichedThoughts);

    const sortFnsOg = {
      latest: (a, b) => new Date(b.date) - new Date(a.date),
      oldest: (a, b) => new Date(a.date) - new Date(b.date),
      az: (a, b) => (a.title || "").localeCompare(b.title || ""),
      za: (a, b) => (b.title || "").localeCompare(a.title || ""),
    };
    for (const [variant, fn] of Object.entries(sortFnsOg)) {
      write(`blog-sorted-${variant}.json`, [...enrichedPosts].sort(fn));
      write(`portfolio-sorted-${variant}.json`, [...enrichedPortfolio].sort(fn));
      write(`thoughts-sorted-${variant}.json`, [...enrichedThoughts].sort(fn));
    }

    // Sync only the metadata JSON files — do NOT call copyMetadataToWeb() here because
    // copyDirRecursive() is destructive (rm -rf before copy) and would wipe out
    // .raksara-responsive/ generated by generateResponsiveImages() above.
    const sveltekitMetaDir = path.join(SVELTEKIT_STATIC_DIR, "metadata");
    fs.mkdirSync(sveltekitMetaDir, { recursive: true });
    for (const f of fs.readdirSync(METADATA_DIR)) {
      const src = path.join(METADATA_DIR, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(sveltekitMetaDir, f));
      }
    }
    console.log("  ✓ Synced enriched metadata JSON to sveltekit/static/metadata/");

    // ── Profile OG image (manifest-cached) ────────────────────────────────
    // Generate a dedicated 1200×630 profile OG image using avatar + cover so
    // social platforms show the person's photo rather than the generic default.
    // Uses the same .manifest.json written by generateOgImages() above so that
    // the image is skipped when the profile data hasn't changed.
    try {
      const profilePage = (pages || []).find((p) => p.slug === 'profile');
      if (profilePage && profilePage.path) {
        const profileMdPath = path.join(REPO_ROOT, profilePage.path);
        if (fs.existsSync(profileMdPath)) {
          const rawMd = fs.readFileSync(profileMdPath, 'utf-8');
          const fm = matter(rawMd).data;

          // Build a hash of the profile inputs so we can skip regeneration when nothing changed.
          const profileHashInput = JSON.stringify({
            name:    fm.title  || ogSiteName,
            role:    fm.role   || '',
            avatar:  fm.avatar || '',
            cover:   fm.cover  || '',
            accent:  ogAccentColor,
            site:    ogSiteName,
          });
          const profileOgHash = crypto.createHash('sha1').update(profileHashInput).digest('hex').slice(0, 16);

          const profileOgDir  = path.join(WEB_DIR, 'og');
          const profileOgPath = path.join(profileOgDir, 'profile.jpg');
          const ogManifestPath = path.join(profileOgDir, '.manifest.json');

          // Read the manifest that generateOgImages() just wrote (or created fresh)
          let ogManifest = {};
          try { ogManifest = JSON.parse(fs.readFileSync(ogManifestPath, 'utf-8')); } catch {}

          if (ogManifest['profile-og'] === profileOgHash && fs.existsSync(profileOgPath)) {
            console.log('  ✓ Profile OG image cached (no changes) → og/profile.jpg');
          } else {
            const profileOgBuf = await generateProfileOgImage({
              webDir: WEB_DIR,
              siteInfo: {
                siteName: ogSiteName,
                siteUrl: ogSiteUrl,
                accentColor: ogAccentColor,
                logoAbsPath: getLocalAssetAbsolutePath(siteConfig && siteConfig.logo),
              },
              profileData: {
                name: fm.title || ogSiteName,
                role: fm.role || '',
                avatarPath: fm.avatar || null,
                coverPath: fm.cover || null,
                metadata: fm.metadata || [],
              },
            });
            fs.mkdirSync(profileOgDir, { recursive: true });
            fs.writeFileSync(profileOgPath, profileOgBuf);
            // Persist the hash so the next build can skip this step
            ogManifest['profile-og'] = profileOgHash;
            fs.writeFileSync(ogManifestPath, JSON.stringify(ogManifest, null, 2));
            console.log('  ✓ Generated profile OG image → og/profile.jpg');
          }
        }
      }
    } catch (profileOgErr) {
      console.warn('[og] Profile OG image generation failed (non-fatal):', profileOgErr.message);
    }
  }
  // --- End OG Image generation ---

  await prerender(enrichedPosts, enrichedThoughts, enrichedPortfolio, enrichedGallery, siteConfig, imageManifest, pages);
  await generateSeoArtifacts({
    posts: enrichedPosts,
    portfolioItems: enrichedPortfolio,
    galleryItems: enrichedGallery,
    thoughts: enrichedThoughts,
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

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath);
      fs.symlinkSync(target, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Non-destructive merge: copy files from srcDir into destDir without deleting anything.
// Used to bubble up legacy nested paths without wiping already-copied content.
function mergeDirInto(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      mergeDirInto(srcPath, destPath);
    } else if (entry.isFile()) {
      // Only write if the target doesn't already exist (don't overwrite canonical content)
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function copyMetadataToWeb() {
  const sveltekitMetaDir = path.join(SVELTEKIT_STATIC_DIR, "metadata");
  fs.mkdirSync(sveltekitMetaDir, { recursive: true });
  const metaFiles = fs.readdirSync(METADATA_DIR);
  for (const f of metaFiles) {
    fs.copyFileSync(path.join(METADATA_DIR, f), path.join(sveltekitMetaDir, f));
  }

  const sveltekitContentDir = path.join(SVELTEKIT_STATIC_DIR, "content");
  if (path.resolve(CONTENT_DIR) !== path.resolve(sveltekitContentDir)) {
    copyDirRecursive(CONTENT_DIR, sveltekitContentDir);
  }

  // Legacy migration: old worker (CONTENT_ROOT='content') wrote files into a
  // nested content/ subdirectory inside the content repo, so after the copy above
  // they land at sveltekit/static/content/content/assets/... but the frontend and
  // build pipeline expect them at sveltekit/static/content/assets/...
  // Bubble those files up one level non-destructively.
  const nestedContentDir = path.join(sveltekitContentDir, "content");
  if (fs.existsSync(nestedContentDir) && fs.statSync(nestedContentDir).isDirectory()) {
    mergeDirInto(nestedContentDir, sveltekitContentDir);
    console.log("  ✓ Migrated legacy content/content/ assets to sveltekit/static/content/");
  }

  console.log("  ✓ Copied metadata and content to sveltekit/static/");
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

  writeWebFile("metadata/prerender-routes.json", `${JSON.stringify(indexableRoutes.map(toPrerenderRoute), null, 2)}\n`);
  writeWebFile("sitemap.xml", buildSitemapXml(siteUrl, indexableRoutes, { posts, portfolioItems }));
  writeWebFile("robots.txt", buildRobotsTxt(siteUrl));
  if (adsenseConfig && adsenseConfig.adsTxtLine) {
    writeWebFile("ads.txt", `${adsenseConfig.adsTxtLine}\n`);
  } else {
    const adsTxtPath = path.join(WEB_DIR, "ads.txt");
    if (fs.existsSync(adsTxtPath)) fs.unlinkSync(adsTxtPath);
  }
  writeWebFile(".nojekyll", "");

  // Write CNAME if the site uses a custom domain (not *.github.io)
  const siteHost = new URL(siteUrl).hostname;
  if (!siteHost.endsWith(".github.io")) {
    writeWebFile("CNAME", siteHost);
    console.log(`  ✓ Generated CNAME (${siteHost})`);
  }

  console.log("  ✓ Generated sitemap.xml");
  console.log("  ✓ Generated prerender route manifest");
  console.log("  ✓ Generated robots.txt");
  if (adsenseConfig && adsenseConfig.adsTxtLine) {
    console.log("  ✓ Generated ads.txt");
  }
  console.log("  ✓ Generated SvelteKit static SEO assets");
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

function buildSitemapXml(siteUrl, routes, context = {}) {
  const { posts = [], portfolioItems = [] } = context;
  const urls = routes
    .map((route) => {
      // Add trailing slash to all non-root URLs to match the live site's redirect behavior
      const clean = route === "/" ? "" : (route.endsWith("/") ? route : route + "/");
      const priority = getSitemapPriority(route);
      const lastmod = getContentLastmod(route, { posts, portfolioItems });
      return [
        "  <url>",
        `    <loc>${escapeXml(siteUrl + clean)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
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

/** Derive a stable lastmod from content, not build time. */
function getContentLastmod(route, { posts, portfolioItems }) {
  if (route.startsWith("/blog/post/")) {
    const slug = route.replace("/blog/post/", "").replace(/\/+$/, "");
    const post = posts.find((p) => p.slug === slug);
    if (post) {
      return (post.updated || post.modified || post.date || "1970-01-01");
    }
  }
  if (route.startsWith("/portfolio/")) {
    const slug = route.replace("/portfolio/", "").replace(/\/+$/, "");
    const item = portfolioItems.find((p) => p.slug === slug);
    if (item) {
      return (item.updated || item.modified || item.date || "1970-01-01");
    }
  }
  // For listing/index pages: use newest child date
  if (route === "/blog" && posts.length > 0) {
    return posts.reduce((latest, p) => {
      const d = p.updated || p.modified || p.date || "";
      return d > latest ? d : latest;
    }, "1970-01-01");
  }
  if (route === "/portfolio" && portfolioItems.length > 0) {
    return portfolioItems.reduce((latest, p) => {
      const d = p.updated || p.modified || p.date || "";
      return d > latest ? d : latest;
    }, "1970-01-01");
  }
  // Fallback for static routes
  return new Date().toISOString().split("T")[0];
}

function toPrerenderRoute(route) {
  if (route === "/") return "/";
  return route.endsWith("/") ? route : `${route}/`;
}

function buildRobotsTxt(siteUrl) {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "# --- Block low-value / internal pages ---",
    "Disallow: /content/",
    "Disallow: /metadata/",
    "Disallow: /vendor/",
    "Disallow: /404.html",
    "Disallow: /admin/",
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
    "# --- Sitemap ---",
    `Sitemap: ${siteUrl}/sitemap.xml`,
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
  if (/^\/[^/]+$/.test(route) && !["/gallery", "/thoughts", "/tags", "/categories", "/admin"].includes(route)) {
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

async function minifyHtmlDocument(html) {
  return String(html)
    .replace(/>\s+</g, "><")
    .replace(/\n{2,}/g, "\n")
    .trim();
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

function writeWebFile(filename, content) {
  const filepath = path.join(WEB_DIR, filename);
  fs.writeFileSync(filepath, content);
}

async function generateResponsiveImages() {
  const contentWebDir = path.join(WEB_DIR, "content");
  if (!fs.existsSync(contentWebDir)) {
    return {};
  }

  const responsiveRoot = path.join(contentWebDir, RESPONSIVE_DIR_NAME);
  fs.mkdirSync(responsiveRoot, { recursive: true });

  // Load existing manifest for hash-based incremental comparison
  const existingManifestPath = path.join(METADATA_DIR, "image-manifest.json");
  let existingManifest = {};
  try {
    existingManifest = JSON.parse(fs.readFileSync(existingManifestPath, "utf8"));
  } catch {
    // No existing manifest — process everything
  }

  const imageFiles = await fg(["**/*.{jpg,jpeg,png,webp,avif}"], {
    cwd: contentWebDir,
    onlyFiles: true,
    ignore: [`${RESPONSIVE_DIR_NAME}/**`],
  });

  const manifest = {};
  let processed = 0;
  let skipped = 0;

  async function processOneImage(relativeFile) {
    const normalizedRelativeFile = relativeFile.replace(/\\/g, "/");
    const absoluteFile = path.join(contentWebDir, relativeFile);
    const publicPath = `content/${normalizedRelativeFile}`;

    // Compute SHA-1 of source file for change detection
    const fileBuffer = fs.readFileSync(absoluteFile);
    const hash = crypto.createHash("sha1").update(fileBuffer).digest("hex");

    const existing = existingManifest[publicPath];
    const parsed = path.posix.parse(normalizedRelativeFile);
    const variantDir = path.join(responsiveRoot, parsed.dir);

    // Skip if hash matches, lqip is present, and all variant files are on disk
    if (existing && existing.hash === hash && existing.lqip && Array.isArray(existing.variants) && existing.variants.length > 0) {
      const allExist = existing.variants.every((v) => {
        const variantRel = v.path.replace(/^content\//, "");
        return fs.existsSync(path.join(contentWebDir, variantRel));
      });
      if (allExist) {
        skipped++;
        manifest[publicPath] = existing;
        return;
      }
    }

    let metadata;
    try {
      metadata = await sharp(absoluteFile).metadata();
    } catch {
      return;
    }

    if (!metadata.width || !metadata.height) {
      return;
    }

    fs.mkdirSync(variantDir, { recursive: true });

    const usableWidths = RESPONSIVE_WIDTHS.filter((w) => w < metadata.width);
    const variants = [];

    // Generate all size variants for this image in parallel
    await Promise.all(
      usableWidths.map(async (width) => {
        const variantFileName = `${parsed.name}-${width}w.webp`;
        const variantAbsolutePath = path.join(variantDir, variantFileName);
        const variantPublicPath = path.posix.join(
          "content",
          RESPONSIVE_DIR_NAME,
          parsed.dir,
          variantFileName,
        );
        const quality = width <= 320 ? 70 : width <= 640 ? 72 : width <= 1280 ? 75 : 78;
        await sharp(absoluteFile)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality })
          .toFile(variantAbsolutePath);
        variants.push({ width, path: variantPublicPath });
      })
    );

    variants.sort((a, b) => a.width - b.width);

    // Generate LQIP: tiny 20px wide WebP encoded as base64 data URI
    const lqipBuffer = await sharp(absoluteFile)
      .resize({ width: 20, withoutEnlargement: false })
      .webp({ quality: 20 })
      .toBuffer();
    const lqip = `data:image/webp;base64,${lqipBuffer.toString("base64")}`;

    processed++;
    manifest[publicPath] = { hash, width: metadata.width, height: metadata.height, lqip, variants };
  }

  // Process images in batches of 4 (safe parallelism on 2-vCPU CI runners)
  const CONCURRENCY = 4;
  for (let i = 0; i < imageFiles.length; i += CONCURRENCY) {
    await Promise.all(imageFiles.slice(i, i + CONCURRENCY).map(processOneImage));
  }

  // Orphan cleanup: remove variant files for images no longer in content
  const currentPublicPaths = new Set(
    imageFiles.map((f) => `content/${f.replace(/\\/g, "/")}`)
  );
  for (const [oldPath, oldEntry] of Object.entries(existingManifest)) {
    if (!currentPublicPaths.has(oldPath) && Array.isArray(oldEntry.variants)) {
      for (const v of oldEntry.variants) {
        const variantRel = v.path.replace(/^content\//, "");
        const vAbsPath = path.join(contentWebDir, variantRel);
        try { fs.unlinkSync(vAbsPath); } catch { /* already gone */ }
      }
    }
  }

  console.log(`  ✓ Responsive images: ${processed} processed, ${skipped} unchanged (${Object.keys(manifest).length} total)`);
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

function toRootRelativePublicPath(p) {
  if (!p) return p;
  if (
    p.startsWith("http://") ||
    p.startsWith("https://") ||
    p.startsWith("data:") ||
    p.startsWith("/")
  ) {
    return p;
  }
  return `/${p}`;
}

function buildResponsiveImageAttrsPrerender(src, options = {}, imageManifest) {
  const resolved = resolvePath(src);
  if (!resolved) return "";
  const publicSrc = toRootRelativePublicPath(resolved);

  const {
    alt = "",
    title = "",
    className = "",
    loading = "lazy",
    fetchPriority = "auto",
    sizes = "100vw",
    decoding = "async",
  } = options;

  const attrs = [`src="${escapeHtml(publicSrc)}"`, `alt="${escapeHtml(alt)}"`];
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
      (variant) => `${escapeHtml(toRootRelativePublicPath(resolvePath(variant.path)))} ${variant.width}w`,
    );

    if (manifestEntry.width) {
      srcset.push(`${escapeHtml(publicSrc)} ${manifestEntry.width}w`);
      attrs.push(`width="${manifestEntry.width}"`);
    }
    if (manifestEntry.height) {
      attrs.push(`height="${manifestEntry.height}"`);
    }
    if (srcset.length) {
      attrs.push(`srcset="${srcset.join(", ")}"`);
    }
    if (manifestEntry.lqip) {
      attrs.push(`data-lqip="${escapeHtml(manifestEntry.lqip)}"`);
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
      <div class="gallery-window">
      <a href="/gallery" class="gallery-window-link" aria-label="View gallery">
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
        </a>
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
          <div class="gallery-window">
          <a href="/gallery" class="gallery-window-link" aria-label="View gallery">
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
        </a>
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
        <div class="home-section-header"><h2>Recent Posts</h2><a href="/blog">View all →</a></div>
        <div class="post-list">${postsHtml || '<div class="empty-state"><p>No posts yet.</p></div>'}</div>
      </div>

      <div class="home-section">
        <div class="home-section-header"><h2>Projects</h2><a href="/portfolio">View all →</a></div>
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
        <div class="home-section-header"><h2>Shower Thoughts</h2><a href="/thoughts">View all →</a></div>
        <div class="thoughts-list">${thoughtsHtml}</div>
      </div>`
          : ""
      }`;
}

async function generateGalleryCover(galleryItems) {
  const outputPath = path.join(WEB_DIR, "content", "assets", "images", "gallery-cover.webp");

  // Resolve an image src string to an absolute path inside CONTENT_DIR.
  // Handles both admin-created paths ("/assets/images/...") and manually-authored
  // paths that already include a "content/" prefix ("/content/assets/images/...").
  function resolveGalleryImagePath(src) {
    if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return null;
    let bare = src.replace(/^\/+/, ""); // strip leading slash(es)
    if (bare.startsWith("content/")) bare = bare.slice("content/".length); // strip CONTENT_ROOT prefix
    const p = path.join(CONTENT_DIR, bare);
    return fs.existsSync(p) ? p : null;
  }

  // Collect one representative image per gallery entry (newest first, up to 4).
  const candidates = [];
  for (const g of galleryItems) {
    if (candidates.length >= 4) break;
    const imgs = g.images && g.images.length > 0 ? g.images : g.image ? [{ src: g.image }] : [];
    if (!imgs.length) continue;
    const src = imgs[0].src || (typeof imgs[0] === "string" ? imgs[0] : "");
    const p = resolveGalleryImagePath(src);
    if (p) candidates.push(p);
  }

  if (!candidates.length) return;

  const size = 280; // half of output dimension
  const total = size * 2; // 560 × 560 canvas
  const bg = { r: 18, g: 21, b: 26 };
  const count = candidates.length;

  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (count === 1) {
      // Single entry: fill the whole canvas
      const cell = await sharp(candidates[0]).resize(total, total, { fit: "cover", position: "centre" }).toBuffer();
      await sharp({ create: { width: total, height: total, channels: 3, background: bg } })
        .composite([{ input: cell, top: 0, left: 0 }])
        .webp({ quality: 62, effort: 6 })
        .toFile(outputPath);

    } else if (count === 2) {
      // Two entries: left / right vertical halves
      const [c0, c1] = await Promise.all([
        sharp(candidates[0]).resize(size, total, { fit: "cover", position: "centre" }).toBuffer(),
        sharp(candidates[1]).resize(size, total, { fit: "cover", position: "centre" }).toBuffer(),
      ]);
      await sharp({ create: { width: total, height: total, channels: 3, background: bg } })
        .composite([
          { input: c0, top: 0, left: 0 },
          { input: c1, top: 0, left: size },
        ])
        .webp({ quality: 62, effort: 6 })
        .toFile(outputPath);

    } else if (count === 3) {
      // Three entries: left half tall + right half split top/bottom
      const [c0, c1, c2] = await Promise.all([
        sharp(candidates[0]).resize(size, total, { fit: "cover", position: "centre" }).toBuffer(),
        sharp(candidates[1]).resize(size, size,  { fit: "cover", position: "centre" }).toBuffer(),
        sharp(candidates[2]).resize(size, size,  { fit: "cover", position: "centre" }).toBuffer(),
      ]);
      await sharp({ create: { width: total, height: total, channels: 3, background: bg } })
        .composite([
          { input: c0, top: 0,    left: 0 },
          { input: c1, top: 0,    left: size },
          { input: c2, top: size, left: size },
        ])
        .webp({ quality: 62, effort: 6 })
        .toFile(outputPath);

    } else {
      // Four entries: 2 × 2 grid
      const cells = await Promise.all(
        candidates.slice(0, 4).map((p) => sharp(p).resize(size, size, { fit: "cover", position: "centre" }).toBuffer()),
      );
      await sharp({ create: { width: total, height: total, channels: 3, background: bg } })
        .composite([
          { input: cells[0], top: 0,    left: 0 },
          { input: cells[1], top: 0,    left: size },
          { input: cells[2], top: size, left: 0 },
          { input: cells[3], top: size, left: size },
        ])
        .webp({ quality: 62, effort: 6 })
        .toFile(outputPath);
    }

    console.log(`  ✓ Generated gallery-cover.webp (${count} image${count !== 1 ? "s" : ""})`);
  } catch (err) {
    console.log("  ⚠ Failed to generate gallery cover:", err.message);
  }
}

// Node.js-compatible custom component processing for prerendering
function preprocessChartsForPrerender(md) {
  return md.replace(/^```chart\n([\s\S]*?)\n```/gm, (match, configText) => {
    const encodedConfig = encodeURIComponent(configText.trim());
    return `<div class="rk-chart-container" data-chart-config="${escapeHtml(encodedConfig)}"></div>`;
  });
}

function preprocessProgressForPrerender(md) {
  return md.replace(/<rk-progress((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*\/?>/g, (match, attrsStr) => {
    const attrs = {};
    const matches = attrsStr.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1].toLowerCase();
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : "true"));
      attrs[key] = value;
    }
    const total = Math.max(1, parseInt(attrs.total, 10) || 100);
    const current = Math.min(total, Math.max(0, parseInt(attrs.current, 10) || 0));
    const pct = (current / total) * 100;
    return `<div class="rk-progress-wrap">
      <div class="rk-progress" data-pct="${pct.toFixed(2)}">
        <div class="rk-progress-track">
          <div class="rk-progress-fill" style="--rk-prog-color:var(--accent); --rk-prog-target:${pct.toFixed(2)}%"></div>
        </div>
      </div>
      <div class="rk-progress-label"><span class="rk-progress-current">${current}</span><span class="rk-progress-sep">/</span><span class="rk-progress-total">${total}</span></div>
    </div>`;
  });
}

// Store grid info temporarily during preprocessing
const gridStoragePrerender = [];

function preprocessGridForPrerender(md) {
  gridStoragePrerender.length = 0;
  return md.replace(/<grid((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|\S+))?)*)\s*>([\s\S]*?)<\/grid>/gi, (match, attrsStr, inner) => {
    const attrs = {};
    const matches = attrsStr.matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g);
    for (const m of matches) {
      const key = m[1].toLowerCase();
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : "true"));
      attrs[key] = value;
    }
    const col = Math.min(4, Math.max(2, parseInt(attrs.column || attrs.col || attrs.cols, 10) || 3));
    // Store the inner content; it will be parsed by marked later
    gridStoragePrerender.push({ col, inner: inner.trim() });
    return `\n\n[[RAKSARA_GRID:${gridStoragePrerender.length - 1}]]\n\n`;
  });
}

async function injectGridPrerender(html, marked) {
  if (gridStoragePrerender.length === 0) return html;
  for (let i = 0; i < gridStoragePrerender.length; i++) {
    const { col, inner } = gridStoragePrerender[i];
    // Process progress bars in the inner content
    const withProgress = preprocessProgressForPrerender(inner);
    // Split by empty lines to get grid items, then wrap each in a grid-item div
    const items = withProgress.split(/\n\s*\n+/).filter(item => item.trim());
    const gridItems = items.map(item => {
      // Parse each item individually to handle markdown in labels
      const parsedItem = marked.parse(item.trim());
      // Remove the outer <p> tags if marked wrapped it
      return parsedItem.replace(/^<p>(.*)<\/p>$/s, '$1');
    }).join('');
    const gridHtml = `<div class="rk-grid rk-grid-cols-${col}">${gridItems}</div>`;
    html = html.replace(`[[RAKSARA_GRID:${i}]]`, gridHtml);
  }
  return html;
}

async function renderCustomMarkdownForPrerender(md) {
  // Apply preprocessors in the same order as the browser version
  let processed = md;
  processed = preprocessChartsForPrerender(processed);
  processed = preprocessGridForPrerender(processed);
  // Parse with marked
  const { marked } = await import('marked');
  let parsed = marked.parse(processed);
  // Now inject grids with proper markdown parsing of inner content
  parsed = await injectGridPrerender(parsed, marked);
  return parsed;
}

async function renderProfilePagePrerender(pages, imageManifest) {
  const profilePage = (pages || []).find((p) => p.slug === "profile");
  if (!profilePage || !profilePage.path) return null;

  const profilePath = path.join(REPO_ROOT, profilePage.path);
  if (!fs.existsSync(profilePath)) return null;

  const raw = fs.readFileSync(profilePath, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  const localResolvePath = (p) => {
    if (!p) return "";
    if (/^https?:\/\//.test(p) || p.startsWith("data:")) return p;
    return p.replace(/^\/+/, "");
  };

  const coverUrl = localResolvePath(frontmatter.cover) || "";
  const coverPublicUrl = toRootRelativePublicPath(coverUrl);
  const avatarUrl = localResolvePath(frontmatter.avatar) || "";

  // Generate a tiny LQIP for the hero background blur layer.
  // The CSS ::before uses filter:blur(22px), so a 28×16px thumbnail at low
  // quality is visually identical to the full image and costs ~400 bytes.
  // This replaces the full 94 KiB aurora-bg download for that layer entirely.
  let heroBgStyle = "";
  if (coverUrl) {
    const imgPath = path.join(WEB_DIR, coverUrl);
    if (fs.existsSync(imgPath)) {
      try {
        const lqipBuf = await sharp(imgPath)
          .resize(28, 16, { fit: "cover" })
          .webp({ quality: 25 })
          .toBuffer();
        const lqipDataUrl = `data:image/webp;base64,${lqipBuf.toString("base64")}`;
        heroBgStyle = ` style="--profile-hero-image-blur: url('${lqipDataUrl}')"`;
      } catch {
        // Skip LQIP if sharp fails — CSS fallback to var(--profile-hero-image)
      }
    }
  }
  const name = frontmatter.title || "Profile";
  const role = frontmatter.role || "";

  const linkDefs = {
    github: { label: "GitHub", prefix: "" },
    linkedin: { label: "LinkedIn", prefix: "" },
    medium: { label: "Medium", prefix: "" },
    twitter: { label: "Twitter", prefix: "" },
    website: { label: "Website", prefix: "" },
    email: { label: "Email", prefix: "mailto:" },
  };
  const links = [];
  for (const [key, def] of Object.entries(linkDefs)) {
    if (frontmatter[key]) {
      links.push(`<a href="${def.prefix}${escapeHtml(frontmatter[key])}" target="_blank" rel="noopener">${def.label}</a>`);
    }
  }

  const metaItems = Array.isArray(frontmatter.metadata) ? frontmatter.metadata : [];
  let metaHtml = "";
  if (metaItems.length) {
    metaHtml =
      '<div class="profile-metadata">' +
      metaItems
        .map((m) => {
          if (typeof m === "string") return `<span class="profile-meta-chip">${escapeHtml(m)}</span>`;
          const label = m.label || "";
          const value = m.value || "";
          const url = m.url || "";
          const display = value || label;
          if (url)
            return `<a href="${escapeHtml(url)}" class="profile-meta-chip has-link" target="_blank" rel="noopener">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ""}${escapeHtml(display !== label ? display : "")}</a>`;
          return `<span class="profile-meta-chip">${label ? `<span class="meta-label">${escapeHtml(label)}</span>` : ""}${escapeHtml(display !== label ? display : "")}</span>`;
        })
        .join("") +
      "</div>";
  }

  const waveSvg = `<div class="hero-waves"><svg class="hero-wave hero-wave-back" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,45 C100,20 200,55 360,30 C480,12 560,50 720,35 C850,22 1000,55 1140,28 C1280,8 1380,42 1440,38 L1440,80 L0,80 Z"/></svg><svg class="hero-wave hero-wave-front" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,38 C80,52 180,15 320,42 C430,60 540,18 700,40 C820,55 960,12 1100,45 C1220,62 1340,22 1440,35 L1440,80 L0,80 Z"/></svg></div>`;
  const shareButtonHtml = `<button class="share-btn" aria-label="Share"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 8.5v5a1 1 0 001 1h6a1 1 0 001-1v-5M8 1v8.5M5 4l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share</span></button>`;

  const avatarHtml = avatarUrl
    ? `<div class="profile-avatar-wrap is-loading"><img ${buildResponsiveImageAttrsPrerender(
        avatarUrl,
        { alt: name, className: "profile-avatar", loading: "eager", sizes: "110px" },
        imageManifest,
      )}></div>`
    : "";

  const bodyHtml = await renderCustomMarkdownForPrerender(body || "");

  return `<div class="profile-hero" id="profile-hero">
      <div class="profile-hero-bg" id="profile-hero-bg" data-src="${escapeHtml(coverPublicUrl)}"${heroBgStyle}></div>
      <div class="profile-hero-skeleton"></div>
      <div class="profile-hero-overlay"></div>
      <div class="profile-hero-share">${shareButtonHtml}</div>
      <div class="profile-hero-content">
        ${avatarHtml}
        <div class="profile-info">
          <h1>${escapeHtml(name)}</h1>
          ${role ? `<div class="profile-role">${escapeHtml(role)}</div>` : ""}
          ${links.length ? `<div class="profile-links">${links.join("")}</div>` : ""}
        </div>
      </div>
      ${waveSvg}
    </div>
    ${metaHtml}
    <div class="article-body">${bodyHtml}</div>`;
}

async function prerender(posts, thoughts, portfolio, gallery, config, imageManifest, pages) {
  const SEO_INITIAL_COUNT = 12;
  const homeMarkup = renderHomePagePrerender(posts, thoughts, portfolio, gallery, config, imageManifest);
  const cacheFile = path.join(METADATA_DIR, "home-prerender.json");
  fs.writeFileSync(cacheFile, JSON.stringify({ html: homeMarkup }), "utf-8");
  fs.copyFileSync(
    cacheFile,
    path.join(WEB_DIR, "metadata", "home-prerender.json"),
  );
  console.log("  ✓ Prerendered homepage markup");

  // Emit a slim home-bundle.json combining the three critical-path files so the
  // home route can be bootstrapped with a single fetch instead of three separate ones.
  try {
    const homeBundle = {
      config,
      posts: posts.slice(0, SEO_INITIAL_COUNT),
      homePrerender: { html: homeMarkup },
    };
    const bundleCacheFile = path.join(METADATA_DIR, "home-bundle.json");
    fs.writeFileSync(bundleCacheFile, JSON.stringify(homeBundle), "utf-8");
    fs.copyFileSync(bundleCacheFile, path.join(WEB_DIR, "metadata", "home-bundle.json"));
    console.log("  ✓ Generated home-bundle.json");
  } catch (err) {
    console.log("  ⚠ home-bundle.json generation failed:", err.message);
  }

  try {
    const profileMarkup = await renderProfilePagePrerender(pages, imageManifest);
    if (profileMarkup) {
      const profileCacheFile = path.join(METADATA_DIR, "profile-prerender.json");
      fs.writeFileSync(profileCacheFile, JSON.stringify({ html: profileMarkup }), "utf-8");
      fs.copyFileSync(profileCacheFile, path.join(WEB_DIR, "metadata", "profile-prerender.json"));
      console.log("  ✓ Prerendered profile markup");
    }
  } catch (err) {
    console.log("  ⚠ Profile prerender failed:", err.message);
  }
}

function copyHighlightRuntime() {
  try {
    const packageRoot = path.join(REPO_ROOT, "node_modules", "highlight.js");
    const srcEsDir = path.join(packageRoot, "es");
    const srcLibDir = path.join(packageRoot, "lib");
    const srcStylesDir = path.join(packageRoot, "styles");
    const destRoot = path.join(WEB_DIR, "vendor", "hljs");

    if (!fs.existsSync(srcEsDir) || !fs.existsSync(srcLibDir)) {
      console.log("  ⚠ highlight.js runtime not found, skipping language module copy");
      return;
    }

    fs.rmSync(destRoot, { recursive: true, force: true });
    copyDirRecursive(srcEsDir, path.join(destRoot, "es"));
    copyDirRecursive(srcLibDir, path.join(destRoot, "lib"));

    // Copy CSS theme files so highlight.js CSS works without CDN
    const themeFiles = ["github-dark.min.css", "github.min.css"];
    if (fs.existsSync(srcStylesDir)) {
      const destStylesDir = path.join(destRoot, "styles");
      fs.mkdirSync(destStylesDir, { recursive: true });
      for (const theme of themeFiles) {
        const src = path.join(srcStylesDir, theme);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(destStylesDir, theme));
        }
      }
    }

    console.log("  ✓ Highlight.js runtime copied for on-demand language loading");
  } catch (err) {
    console.error("  ✗ Highlight runtime copy failed:", err.message);
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
    const highlightInput = path.join(REPO_ROOT, "scripts", "vendor-highlight-entry.js");
    const highlightOutput = path.join(WEB_DIR, "vendor-highlight.min.js");

    // Bundle highlight.js core as a browser-ready IIFE (optional — CDN fallback used if absent)
    if (fs.existsSync(highlightInput)) {
      try {
        const highlightSize = await bundleBrowserVendor({
          inputPath: highlightInput,
          outputPath: highlightOutput,
          name: "RaksaraHighlightVendor",
        });
        console.log(`  ✓ Highlight vendor bundle: ${(highlightSize/1024).toFixed(1)} KB`);
      } catch (err) {
        console.warn("  ⚠ Highlight vendor bundle skipped:", err.message);
      }
    }

    // Bundle Chart.js — loaded on demand when a chart code block is encountered
    const chartInput = path.join(REPO_ROOT, "scripts", "vendor-chart-entry.js");
    const chartOutput = path.join(WEB_DIR, "vendor-chart.min.js");
    if (fs.existsSync(chartInput)) {
      try {
        const chartSize = await bundleBrowserVendor({
          inputPath: chartInput,
          outputPath: chartOutput,
          name: "RaksaraChartVendor",
        });
        console.log(`  ✓ Chart vendor bundle: ${(chartSize/1024).toFixed(1)} KB`);
      } catch (err) {
        console.warn("  ⚠ Chart vendor bundle skipped:", err.message);
      }
    }
  } catch (err) {
    console.error("  ✗ Vendor bundle failed:", err.message);
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
    await bundleVendorJS();
  } finally {
    cleanupSymlink();
  }
}

runBuild().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
