import { Head, Link } from '@inertiajs/react';
import type { ComponentType } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { show } from '@/routes/dev/designSystem';

/**
 * Bench registry. A section is one file, `./sections/<name>.tsx`, with a
 * default export that takes no props; it is served at
 * `/dev/design-system/<name>` (lowercase letters, digits and hyphens only).
 *
 * Group shown on the index: the section file's `export const group`, when it
 * has one. Otherwise the naming rule decides, on the server: a section named
 * like a file of `components/ui` is "UI", any other is "Skrüm". Foundations
 * and layouts always export their group.
 */
type SectionModule = { default: ComponentType; group?: BenchGroup };

type ListedSection = { name: string; group: BenchGroup };

const modules = import.meta.glob<SectionModule>(
    ['./sections/*.tsx', '!./sections/*.test.tsx'],
    { eager: true },
);

const registry: Record<string, SectionModule | undefined> = Object.fromEntries(
    Object.entries(modules).map(([path, module]) => [
        path.slice('./sections/'.length, -'.tsx'.length),
        module,
    ]),
);

const Groups: [BenchGroup, string][] = [
    ['foundations', 'Foundations'],
    ['layouts', 'Layouts'],
    ['ui', 'UI'],
    ['skrum', 'Skrüm'],
];

function Index({ sections }: { sections: ListedSection[] }) {
    const listed = sections
        .filter((section) => registry[section.name] !== undefined)
        .map((section) => ({
            name: section.name,
            group: registry[section.name]?.group ?? section.group,
        }));

    return (
        <div className="mx-auto flex max-w-page flex-col gap-10 px-4 py-10 md:px-10">
            <header className="flex flex-col gap-4">
                <SkrumLogo className="h-10 w-auto self-start" />
                <h1 className="font-display text-display-lg">Design system</h1>
            </header>
            {Groups.map(([group, title]) => {
                const names = listed
                    .filter((section) => section.group === group)
                    .map((section) => section.name);

                if (names.length === 0) {
                    return null;
                }

                return (
                    <nav
                        key={group}
                        aria-label={title}
                        className="flex flex-col gap-3"
                    >
                        <h2 className="text-xl font-title tracking-subheading">
                            {title}
                        </h2>
                        <ul className="flex flex-wrap gap-2">
                            {names.map((name) => (
                                <li key={name} className="min-w-0">
                                    <Link
                                        href={show(name)}
                                        className="block truncate rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                                    >
                                        {name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                );
            })}
        </div>
    );
}

export default function DesignSystem({
    section,
    sections = [],
}: {
    section: string | null;
    sections?: ListedSection[];
}) {
    if (section === null) {
        return (
            <>
                <Head title="Design system" />
                <Index sections={sections} />
            </>
        );
    }

    const Section = registry[section]?.default;

    return (
        <>
            <Head title={`Design system · ${section}`} />
            {Section ? (
                <div data-bench-section={section} className="contents">
                    <Section />
                </div>
            ) : (
                <p role="alert" className="p-6 text-sm/snug">
                    The section file exists but is not in the built assets. Run
                    the build again.
                </p>
            )}
        </>
    );
}
