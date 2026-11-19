import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

// What I'm reading: shown inside the book on the desk (/desk).
// The most recently updated entry is the one the book opens to.
const reading = defineCollection({
	loader: glob({ base: './src/content/reading', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		author: z.string(),
		status: z.enum(['reading', 'finished', 'paused']),
		/** Rough progress, 0–100. Leave out if you'd rather not say. */
		progress: z.number().min(0).max(100).optional(),
		updated: z.coerce.date(),
		/** One entry per thought, each printed on its own page of the book. */
		entries: z
			.array(
				z.object({
					page: z.number().int().optional(),
					date: z.coerce.date().optional(),
					note: z.string(),
				}),
			)
			.default([]),
	}),
});

export const collections = { blog, reading };
