// scripts/schemas.js
// Zod validation schemas for all Raksara frontmatter types.
// Used by build-metadata.js at build time to validate content before processing.

const { z } = require("zod");

const ISODate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must start with YYYY-MM-DD"),
    z.date().transform((d) => d.toISOString().split("T")[0]),
  ]);

const StatusSchema = z
  .enum(["draft", "ongoing", "completed", "complete"])
  .transform((value) => (value === "complete" ? "completed" : value));

const PostSchema = z.object({
  title: z.string(),
  date: ISODate,
  updated: ISODate.optional(),
  modified: ISODate.optional(),

  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  series: z.string().optional(),
  chapter: z.union([z.string(), z.number()]).optional(),
  type: z.enum([
    "blog",
    "poem",
    "novel",
    "chapters",
    "comic"
  ]).optional(),
  readingMode: z.boolean().optional(),
  comments_enabled: z.boolean().optional(),
  status: StatusSchema.optional(),
  draft: z.boolean().optional(),
  dir: z.string().optional(),
}).passthrough();

const PortfolioSchema = z.object({
  title: z.string(),
  date: ISODate,
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
  github: z.string().url("github must be a valid URL").optional().or(z.literal("")),
  demo: z.string().url("demo must be a valid URL").optional().or(z.literal("")),
  summary: z.string().optional(),
  cover: z.string().optional(),
  status: StatusSchema.optional(),
  draft: z.boolean().optional(),
}).passthrough();

const GallerySchema = z.object({
  title: z.string(),
  date: ISODate,
  image: z.string().optional(),
  images: z
    .array(
      z.object({
        src: z.string(),
        caption: z.string().optional(),
      })
    )
    .optional(),
  caption: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  draft: z.boolean().optional(),
}).passthrough();

const ThoughtsSchema = z.object({
  title: z.string(),
  date: ISODate,
  tags: z.array(z.string()).optional().default([]),
  draft: z.boolean().optional(),
}).passthrough();

const PageSchema = z.object({
  title: z.string(),
  date: ISODate.optional(),
  summary: z.string().optional(),
  draft: z.boolean().optional(),
  icon: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  next_page: z.unknown().optional(),
  previous_page: z.unknown().optional(),
}).passthrough();

/**
 * Validate frontmatter for a given section.
 * @param {"blog"|"portfolio"|"gallery"|"thoughts"|"pages"} section
 * @param {object} fm - parsed frontmatter object
 * @param {string} filePath - source file path (for error messages)
 * @param {boolean} strict - if true, throw on validation failure; otherwise warn and return null
 * @returns {object|null} validated and defaulted frontmatter, or null on failure
 */
function validateFrontmatter(section, fm, filePath, strict = false) {
  const schemaMap = {
    blog: PostSchema,
    portfolio: PortfolioSchema,
    gallery: GallerySchema,
    thoughts: ThoughtsSchema,
    pages: PageSchema,
  };

  const schema = schemaMap[section];
  if (!schema) return fm; // unknown section — pass through

  const result = schema.safeParse(fm);
  if (result.success) return result.data;

  const errors = result.error.issues
    .map((i) => `  [${i.path.join(".")}] ${i.message}`)
    .join("\n");
  const msg = `[Zod] Validation failed for ${filePath} (section: ${section}):\n${errors}`;

  if (strict) {
    throw new Error(msg);
  } else {
    console.warn(msg);
    return fm; // fallback to raw frontmatter so build continues
  }
}

module.exports = {
  PostSchema,
  PortfolioSchema,
  GallerySchema,
  ThoughtsSchema,
  PageSchema,
  validateFrontmatter,
};
