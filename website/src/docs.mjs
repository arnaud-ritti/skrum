/**
 * @template {{ id: string, data: { order: number, related?: string[] } }} Page
 * @param {Page[]} pages
 * @param {ReadonlyArray<{ id: string }>} sections
 * @returns {Page[]}
 */
export function orderPages(pages, sections) {
    const sectionIds = sections.map((section) => section.id);
    const file = (id) => `src/content/docs/${id}.md`;
    const places = new Map();

    for (const page of pages) {
        const [section, ...rest] = page.id.split('/');

        if (!sectionIds.includes(section) || rest.length !== 1) {
            throw new Error(`${file(page.id)} is not in a section folder (sections: ${sectionIds.join(', ')}).`);
        }

        const place = `${section}#${page.data.order}`;

        if (places.has(place)) {
            throw new Error(`${file(page.id)} and ${file(places.get(place))} both have order ${page.data.order}.`);
        }

        places.set(place, page.id);
    }

    const ids = new Set(pages.map((page) => page.id));

    for (const page of pages) {
        for (const related of page.data.related ?? []) {
            if (!ids.has(related)) {
                throw new Error(`${file(page.id)}: related "${related}" names no page.`);
            }
        }
    }

    const sectionOf = (page) => sectionIds.indexOf(page.id.split('/')[0]);

    return [...pages].sort((a, b) => sectionOf(a) - sectionOf(b) || a.data.order - b.data.order);
}
