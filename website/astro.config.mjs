import { defineConfig } from 'astro/config';
import { url } from './site.mjs';

export default defineConfig({
    site: url.origin,
    base: url.pathname,
    trailingSlash: 'always',
    markdown: {
        shikiConfig: {
            themes: { light: 'github-light', dark: 'github-dark' },
        },
    },
});
