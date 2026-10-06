export const colors = ['sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss'];
export const headings = ['What it is', 'Goal', 'When to use it', 'When to pick another format', 'How to run it'];

export const columnCount = (template) => `${template.columns.length} ${template.columns.length === 1 ? 'column' : 'columns'}`;

const dataFile = 'src/data/retro-templates.json';
const file = (slug) => `src/content/templates/${slug}.md`;

function checkHeadings(explanation) {
    const found = [...explanation.body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((match) => match[1]).filter((title) => headings.includes(title));
    const missing = headings.find((title) => !found.includes(title));

    if (missing !== undefined) {
        throw new Error(`${file(explanation.id)} lacks the heading "${missing}".`);
    }

    if (found.join('|') !== headings.join('|')) {
        throw new Error(`${file(explanation.id)} has its headings out of order (expected: ${headings.join(', ')}).`);
    }
}

/**
 * @typedef {{ key: string, slug: string, category: string, name: string, columns: { title: string, description: string, color: string }[] }} Template
 * @typedef {{ id: string, data: { summary: string, related: { template: string, why: string }[] }, body: string }} Explanation
 * @param {{ categories: { id: string, name: string }[], templates: Template[] }} data
 * @param {Explanation[]} explanations
 * @returns {(Template & { explanation: Explanation | null, relatedBy: string[], previous: string | null, next: string | null })[]}
 */
export function catalogue(data, explanations) {
    const slugs = new Set();

    for (const template of data.templates) {
        if (slugs.has(template.slug)) {
            throw new Error(`${dataFile}: two templates have the slug "${template.slug}".`);
        }

        slugs.add(template.slug);

        const unknown = template.columns.find((column) => !colors.includes(column.color));

        if (unknown !== undefined) {
            throw new Error(`${dataFile}: the template "${template.slug}" has a column of colour "${unknown.color}" (column colours: ${colors.join(', ')}).`);
        }
    }

    const written = new Map();
    const relatedBy = new Map(data.templates.map((template) => [template.slug, []]));

    for (const explanation of explanations) {
        if (!slugs.has(explanation.id)) {
            throw new Error(`${file(explanation.id)} names no template.`);
        }

        const related = explanation.data.related;

        if (related.length < 2) {
            throw new Error(`${file(explanation.id)} has fewer than two related templates.`);
        }

        for (const { template } of related) {
            if (template === explanation.id) {
                throw new Error(`${file(explanation.id)} names itself as related.`);
            }

            if (!slugs.has(template)) {
                throw new Error(`${file(explanation.id)}: related "${template}" names no template.`);
            }

            relatedBy.get(template).push(explanation.id);
        }

        written.set(explanation.id, explanation);
    }

    if (written.size === slugs.size) {
        for (const template of data.templates) {
            checkHeadings(written.get(template.slug));

            if (relatedBy.get(template.slug).length === 0) {
                throw new Error(`${file(template.slug)} is named as related by no other template.`);
            }
        }
    }

    return data.templates.map((template, index) => ({
        ...template,
        explanation: written.get(template.slug) ?? null,
        relatedBy: relatedBy.get(template.slug),
        previous: data.templates[index - 1]?.slug ?? null,
        next: data.templates[index + 1]?.slug ?? null,
    }));
}
