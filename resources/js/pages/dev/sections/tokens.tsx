import { Link } from '@inertiajs/react';
import type { CSSProperties, ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { useTrans } from '@/hooks/use-trans';
import { index as designSystemIndex } from '@/routes/dev/designSystem';

export const group: BenchGroup = 'foundations';

const Semantic = [
    'background',
    'foreground',
    'card',
    'popover',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'destructive',
    'destructive-foreground',
    'border',
    'input',
    'ring',
    'sidebar',
    'sidebar-accent',
    'skrum-canvas',
    'skrum-primary-soft',
    'skrum-primary-text',
];
const States = ['success', 'warning', 'info'].flatMap((state) => [
    `skrum-${state}`,
    `skrum-${state}-foreground`,
    `skrum-${state}-soft`,
    `skrum-${state}-text`,
]);
const Columns = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
];
const Presence = Array.from({ length: 12 }, (_, index) => index + 1);
const Roti = [1, 2, 3, 4, 5];
const Charts = [1, 2, 3, 4, 5];
const Radii = [
    'rounded-xs',
    'rounded-sm',
    'rounded-md',
    'rounded-lg',
    'rounded-xl',
    'rounded-2xl',
    'rounded-full',
];
const Shadows = [
    'shadow-card',
    'shadow-raised',
    'shadow-popover',
    'shadow-modal',
    'shadow-drag',
];
const Durations = [
    ['instant', 'duration-80'],
    ['fast', 'duration-140'],
    ['base', 'duration-220'],
    ['slow', 'duration-360'],
    ['flip', 'duration-520'],
];
const Type: [string, string][] = [
    ['display-2xl', 'text-6xl/16 font-bold tracking-display font-display'],
    ['display-xl', 'text-display-xl font-display'],
    ['display-lg', 'text-display-lg font-display'],
    ['heading-xl', 'text-2xl font-title tracking-heading'],
    ['heading-lg', 'text-xl font-title tracking-subheading'],
    ['heading-md', 'text-base font-semibold'],
    ['body-lg', 'text-base/relaxed'],
    ['body', 'text-sm/snug'],
    ['body-sm', 'text-body-sm'],
    ['caption', 'text-xs font-medium'],
    ['overline', 'text-overline uppercase'],
    ['mono', 'font-mono text-body-sm font-medium'],
    ['timer', 'font-mono text-stat font-semibold tabular-nums'],
    ['poker-value', 'text-poker font-display'],
];

function Swatch({
    name,
    style,
    className,
}: {
    name: string;
    style?: CSSProperties;
    className?: string;
}) {
    return (
        <figure className="flex min-w-0 flex-col gap-1">
            <div
                className={`h-14 rounded-lg border ${className ?? ''}`}
                style={style}
            />
            <figcaption className="truncate font-mono text-xs font-medium text-muted-foreground">
                {name}
            </figcaption>
        </figure>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-title tracking-subheading">{title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
                {children}
            </div>
        </section>
    );
}

export default function TokensSection() {
    const { t } = useTrans();
    const fill = (token: string): CSSProperties => ({
        backgroundColor: `var(--${token})`,
    });

    return (
        <div className="mx-auto flex max-w-page flex-col gap-10 px-4 py-10 md:px-10">
            <header className="flex flex-col gap-4">
                <SkrumLogo className="h-10 w-auto self-start" />
                <h1 className="font-display text-display-lg">Design system</h1>
                <Link
                    href={designSystemIndex()}
                    className="self-start truncate rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                    All sections
                </Link>
            </header>

            <Group title="Semantic">
                {Semantic.map((token) => (
                    <Swatch key={token} name={token} style={fill(token)} />
                ))}
            </Group>
            <Group title="States">
                {States.map((token) => (
                    <Swatch key={token} name={token} style={fill(token)} />
                ))}
            </Group>
            <Group title="Columns">
                {Columns.map((color) => (
                    <figure
                        key={color}
                        className={`col-${color} flex min-w-0 flex-col gap-1`}
                    >
                        <div className="rounded-lg border border-(--col-border) bg-(--col) p-3 text-(--col-text)">
                            <span className="text-overline uppercase">
                                {color}
                            </span>
                            <p className="text-sm/snug text-foreground">
                                {t('Card text')}
                            </p>
                        </div>
                    </figure>
                ))}
            </Group>
            <Group title="Presence">
                {Presence.map((index) => (
                    <figure key={index} className="flex items-center gap-2">
                        <span
                            className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                                backgroundColor: `var(--skrum-presence-${index})`,
                                color: `var(--skrum-presence-${index}-foreground)`,
                            }}
                        >
                            {index}
                        </span>
                    </figure>
                ))}
            </Group>
            <Group title="ROTI">
                {Roti.map((index) => (
                    <Swatch
                        key={index}
                        name={`skrum-roti-${index}`}
                        style={fill(`skrum-roti-${index}`)}
                    />
                ))}
            </Group>
            <Group title="Charts">
                {Charts.map((index) => (
                    <Swatch
                        key={index}
                        name={`chart-${index}`}
                        style={fill(`chart-${index}`)}
                    />
                ))}
            </Group>
            <Group title="Radii">
                {Radii.map((radius) => (
                    <Swatch
                        key={radius}
                        name={radius}
                        className={`bg-muted ${radius}`}
                    />
                ))}
            </Group>
            <Group title="Shadows">
                {Shadows.map((shadow) => (
                    <Swatch
                        key={shadow}
                        name={shadow}
                        className={`bg-card ${shadow}`}
                    />
                ))}
            </Group>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">
                    Durations
                </h2>
                <ul className="flex flex-col gap-2">
                    {Durations.map(([name, duration]) => (
                        <li
                            key={name}
                            className="group flex items-center gap-3"
                        >
                            <span className="w-24 shrink-0 truncate font-mono text-xs font-medium">
                                {name}
                            </span>
                            <span className="h-2 flex-1 rounded-full bg-muted">
                                <span
                                    className={`block h-2 w-8 rounded-full bg-primary transition-[width] ease-standard group-hover:w-full ${duration}`}
                                />
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">Type</h2>
                <ul className="flex flex-col gap-3">
                    {Type.map(([name, classes]) => (
                        <li key={name} className="flex min-w-0 flex-col">
                            <span className="font-mono text-xs font-medium text-muted-foreground">
                                {name}
                            </span>
                            <span className={`truncate ${classes}`}>
                                {t('Meetings end, actions remain.')}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">
                    Canvas
                </h2>
                <div className="bg-dotgrid h-32 rounded-xl border" />
            </section>
        </div>
    );
}
