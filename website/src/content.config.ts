import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
    schema: z
        .object({
            title: z.string().min(1),
            description: z.string().min(1),
            order: z.number().int().positive(),
            related: z.array(z.string()).optional(),
        })
        .strict(),
});

const templates = defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/templates' }),
    schema: z
        .object({
            summary: z.string().min(1).max(160),
            related: z.array(z.object({ template: z.string().min(1), why: z.string().min(1) }).strict()),
        })
        .strict(),
});

export const collections = { docs, templates };
