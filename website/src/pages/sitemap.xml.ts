import { getCollection } from 'astro:content';
import data from '../data/retro-templates.json';
import { catalogue } from '../templates.mjs';
import { url } from '../../site.mjs';

export async function GET(): Promise<Response> {
    const docs = await getCollection('docs');
    const templates = catalogue(data, await getCollection('templates'));
    const paths = ['', 'docs/', ...docs.map((page) => `docs/${page.id}/`), ...templates.map((template) => `docs/retrospectives/templates/${template.slug}/`)];
    const escape = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
    const entries = paths.map((path) => `<url><loc>${escape(new URL(path, url).href)}</loc></url>`).join('\n');

    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
}
