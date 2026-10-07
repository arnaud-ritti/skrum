import { url } from '../../site.mjs';

export function GET(): Response {
    return new Response(`User-agent: *\nAllow: ${url.pathname}\n\nSitemap: ${new URL('sitemap.xml', url)}\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
