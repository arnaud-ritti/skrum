import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { RetroTemplatePicker } from '@/components/skrum/retro-template-picker';
import type {
    RetroTemplate,
    TemplateSource,
} from '@/components/skrum/retro-template-picker';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function useSamples() {
    const { t } = useTrans();
    const builtin = (
        id: string,
        name: string,
        description: string,
        columns: RetroTemplate['columns'],
        extra: Partial<RetroTemplate> = {},
    ): RetroTemplate => ({
        id,
        name,
        description,
        source: 'builtin',
        columns,
        defaults: {
            votesPerPerson: 5,
            maxPerCard: 3,
            anonymous: false,
            timers: { writing: 300, voting: 120, discussing: 600 },
        },
        ...extra,
    });
    const startStop = builtin(
        'start-stop-continue',
        t('Start, Stop, Continue'),
        t('What we start, stop and keep doing.'),
        [
            {
                title: t('Start'),
                color: 'green',
                description: t('What should we start doing?'),
            },
            {
                title: t('Stop'),
                color: 'red',
                description: t('What should we stop doing?'),
            },
            {
                title: t('Continue'),
                color: 'blue',
                description: t('What works and we keep?'),
            },
        ],
        { isTeamDefault: true, usageCount: 6 },
    );
    const glad = builtin(
        'glad-sad-mad',
        t('Glad, Sad, Mad'),
        t('How the sprint felt, emotion by emotion.'),
        [
            { title: t('Glad'), color: 'sun' },
            { title: t('Sad'), color: 'sky' },
            { title: t('Mad'), color: 'coral' },
        ],
    );
    const fourL = builtin(
        '4l',
        t('4L'),
        t('Liked, Learned, Lacked, Longed for.'),
        [
            { title: t('Liked'), color: 'moss' },
            { title: t('Learned'), color: 'iris' },
            { title: t('Lacked'), color: 'apricot' },
            { title: t('Longed for'), color: 'plum' },
        ],
    );
    const sailboat = builtin(
        'sailboat',
        t('Sailboat'),
        t('Wind, anchor, rocks, island.'),
        [
            { title: t('Wind'), color: 'lagoon' },
            { title: t('Anchor'), color: 'apricot' },
            { title: t('Rocks'), color: 'coral' },
            { title: t('Island'), color: 'moss' },
        ],
    );
    const starfish = builtin(
        'starfish',
        t('Starfish'),
        t('Keep, more, less, stop, start.'),
        [
            { title: t('Keep'), color: 'moss' },
            { title: t('More of'), color: 'lagoon' },
            { title: t('Less of'), color: 'apricot' },
            { title: t('Stop'), color: 'coral' },
            { title: t('Start'), color: 'sky' },
        ],
    );
    const kalm = builtin('kalm', t('KALM'), t('Keep, Add, Less, More.'), [
        { title: t('Keep'), color: 'green' },
        { title: t('Add'), color: 'blue' },
        { title: t('Less'), color: 'amber' },
        { title: t('More'), color: 'purple' },
    ]);
    const daki = builtin('daki', t('DAKI'), t('Drop, Add, Keep, Improve.'), [
        { title: t('Drop'), color: 'slate' },
        { title: t('Add'), color: 'blue' },
        { title: t('Keep'), color: 'green' },
        { title: t('Improve'), color: 'amber' },
    ]);
    const long = builtin(
        'long',
        t(
            'Rétrospective de fin de trimestre avec toute l’équipe produit et technique',
        ),
        t(
            'Un format très détaillé pour faire le point sur le trimestre écoulé, les réussites, les difficultés rencontrées et les actions à engager pour le suivant.',
        ),
        [
            {
                title: t('Ce qui nous a rendus fiers pendant le trimestre'),
                color: 'moss',
                description: t(
                    'Les réussites collectives dont nous voulons nous souvenir longtemps.',
                ),
            },
            { title: t('Ce qui nous a freinés'), color: 'coral' },
        ],
    );
    const workspace: RetroTemplate = {
        id: 'ws-1',
        name: t('Nordlys sprint review'),
        description: t('Our own format.'),
        source: 'workspace',
        workspaceName: t('Nordlys workspace'),
        usageCount: 3,
        columns: [
            { title: t('Shipped'), color: 'moss' },
            { title: t('Blocked'), color: 'coral' },
        ],
        defaults: {
            votesPerPerson: 4,
            anonymous: true,
            timers: { writing: 240 },
        },
    };
    const eight = [
        startStop,
        glad,
        fourL,
        sailboat,
        starfish,
        kalm,
        daki,
        long,
    ];
    const forty: RetroTemplate[] = Array.from({ length: 40 }, (_, index) => ({
        ...eight[index % eight.length],
        id: `generated-${index}`,
        name: `${eight[index % eight.length].name} ${index + 1}`,
        isTeamDefault: index === 0,
    }));

    return { startStop, long, workspace, eight, forty };
}

function Demo({
    templates,
    initialValue,
    initialTab,
    initialQuery,
    loading,
    width,
}: {
    templates: RetroTemplate[];
    initialValue?: string;
    initialTab?: TemplateSource;
    initialQuery?: string;
    loading?: boolean;
    width?: string;
}) {
    const [value, setValue] = useState(
        initialValue ?? templates[0]?.id ?? 'custom',
    );
    const [tab, setTab] = useState<TemplateSource>(initialTab ?? 'builtin');
    const [query, setQuery] = useState(initialQuery ?? '');

    return (
        <div className={width ?? 'w-full'}>
            <RetroTemplatePicker
                value={value}
                onValueChange={setValue}
                templates={templates}
                tab={tab}
                onTabChange={setTab}
                query={query}
                onQueryChange={setQuery}
                loading={loading}
                onUse={noop}
                onDuplicate={noop}
                onCreate={noop}
            />
        </div>
    );
}

export default function RetroTemplatePickerSection() {
    const { t } = useTrans();
    const { startStop, long, workspace, eight, forty } = useSamples();

    return (
        <div className="flex flex-col gap-10 p-4 md:p-6">
            <Example
                label={t(
                    'Default, selected card, hover and focus with the keyboard (arrows in both directions, Enter uses, / searches)',
                )}
            >
                <Demo templates={[...eight, workspace]} />
            </Example>
            <Example label={t('Workspace tab (workspace badge and usage)')}>
                <Demo
                    templates={[...eight, workspace]}
                    initialValue="ws-1"
                    initialTab="workspace"
                />
            </Example>
            <Example label={t('Search with no result')}>
                <Demo templates={[...eight, workspace]} initialQuery="zzzz" />
            </Example>
            <Example label={t('Empty workspace tab')}>
                <Demo templates={eight} initialTab="workspace" />
            </Example>
            <Example label={t('Loading')}>
                <Demo templates={eight} loading />
            </Example>
            <Example label={t('0 templates')}>
                <Demo templates={[]} initialValue="custom" />
            </Example>
            <Example label={t('1 template')}>
                <Demo templates={[startStop]} />
            </Example>
            <Example label={t('Long French names and descriptions')}>
                <Demo templates={[long, startStop]} initialValue={long.id} />
            </Example>
            <Example label={t('40 templates')}>
                <Demo templates={forty} />
            </Example>
            <Example label={t('Narrow container (20rem)')}>
                <Demo templates={eight} width="w-80 max-w-full" />
            </Example>
        </div>
    );
}
