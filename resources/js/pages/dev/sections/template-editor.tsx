import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    ColumnColorOptions,
    ColumnColorPicker,
    columnColors,
    serverColumnColors,
} from '@/components/skrum/column-color-picker';
import type { AnyColumnColor } from '@/components/skrum/column-color-picker';
import { TemplateEditor } from '@/components/skrum/template-editor';
import type {
    TemplateDefaults,
    TemplateDraft,
    TemplateEditorProps,
} from '@/components/skrum/template-editor';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function useDrafts() {
    const { t } = useTrans();
    const defaults: TemplateDefaults = {
        votesPerPerson: 5,
        maxPerCard: 2,
        anonymous: true,
        timers: { writing: 5, voting: 3 },
    };

    const server: TemplateDraft = {
        name: t('Start, Stop, Continue'),
        category: 'essentials',
        columns: [
            { id: 'a', title: t('Start'), color: 'green' },
            {
                id: 'b',
                title: t('Stop'),
                description: t('What slowed us down?'),
                color: 'red',
            },
            { id: 'c', title: t('Continue'), color: 'blue' },
        ],
    };

    const full: TemplateDraft = {
        name: t('Start, Stop, Continue'),
        description: t('Three simple columns to look back on the sprint.'),
        visibility: 'team',
        columns: [
            { id: 'a', title: t('Start'), color: 'sky' },
            {
                id: 'b',
                title: t('Stop'),
                description: t('What slowed us down?'),
                color: 'coral',
            },
            { id: 'c', title: t('Continue'), color: 'moss' },
        ],
        defaults,
    };

    const longTitle = t(
        'What we should absolutely keep doing together next sprint, without changing anything about it',
    );

    const ten: TemplateDraft = {
        name: t('Quarterly retrospective of the platform and payments team'),
        category: 'analysis',
        columns: Array.from({ length: 10 }, (_, index) => ({
            id: `x${index}`,
            title: `${index + 1}. ${longTitle}`.slice(0, 100),
            description:
                index % 2 === 0
                    ? t(
                          'What slowed us down the most during this sprint, and what could we try on Monday so that it does not happen again?',
                      )
                    : null,
            color: serverColumnColors[index % serverColumnColors.length],
        })),
    };

    const categories = [
        { value: 'essentials', label: t('Essentials') },
        { value: 'team_mood', label: t('Team mood') },
        { value: 'themed', label: t('Themed') },
        { value: 'ideas', label: t('Ideas') },
        { value: 'analysis', label: t('Analysis') },
    ];

    return { server, full, ten, defaults, categories };
}

function Editor({
    initial,
    ...props
}: { initial: TemplateDraft } & Partial<TemplateEditorProps>) {
    const [value, setValue] = useState(initial);

    return (
        <TemplateEditor
            mode="edit"
            value={value}
            onChange={setValue}
            onSave={() => undefined}
            onCancel={() => undefined}
            {...props}
        />
    );
}

function StartFromEditor() {
    const { t } = useTrans();
    const { categories } = useDrafts();
    const sources: Record<string, TemplateDraft> = {
        mad_sad_glad: {
            name: t('Mad, Sad, Glad'),
            category: 'team_mood',
            columns: [
                { id: 'm', title: t('Mad'), color: 'red' },
                { id: 's', title: t('Sad'), color: 'blue' },
                { id: 'g', title: t('Glad'), color: 'green' },
            ],
        },
        four_ls: {
            name: t('4Ls'),
            category: 'essentials',
            columns: [
                { id: 'l1', title: t('Liked'), color: 'green' },
                { id: 'l2', title: t('Learned'), color: 'blue' },
                { id: 'l3', title: t('Lacked'), color: 'amber' },
                { id: 'l4', title: t('Longed for'), color: 'purple' },
            ],
        },
    };
    const [value, setValue] = useState<TemplateDraft>({
        name: '',
        category: 'essentials',
        columns: [{ id: 'n', title: '', color: 'green' }],
    });

    return (
        <TemplateEditor
            mode="create"
            value={value}
            onChange={setValue}
            categories={categories}
            startFrom={Object.entries(sources).map(([key, source]) => ({
                key,
                name: source.name,
            }))}
            onStartFrom={(key) =>
                setValue({
                    ...sources[key],
                    name: value.name || sources[key].name,
                })
            }
            onSave={() => undefined}
            onCancel={() => undefined}
        />
    );
}

function Options({
    colors,
    usedBy,
    title,
}: {
    colors: readonly AnyColumnColor[];
    usedBy?: Partial<Record<AnyColumnColor, string>>;
    title: string;
}) {
    const [value, setValue] = useState<AnyColumnColor>(colors[2]);

    return (
        <div className="w-72 max-w-full rounded-lg border bg-popover p-3 text-popover-foreground shadow-popover">
            <ColumnColorOptions
                value={value}
                onValueChange={setValue}
                colors={colors}
                usedBy={usedBy}
                columnTitle={title}
            />
        </div>
    );
}

function OpenPicker() {
    const { t } = useTrans();
    const [value, setValue] = useState<AnyColumnColor>('blue');

    return (
        <div className="h-64 max-w-88">
            <ColumnColorPicker
                value={value}
                onValueChange={setValue}
                colors={serverColumnColors}
                columnTitle={t('Ideas')}
                usedBy={{ green: t('Continue'), red: t('Stop') }}
                defaultOpen
            />
        </div>
    );
}

export default function TemplateEditorSection() {
    const { t } = useTrans();
    const { server, full, ten, defaults, categories } = useDrafts();
    const empty: TemplateDraft = {
        name: '',
        visibility: 'personal',
        columns: [{ id: 'n', title: '', color: 'sun' }],
        defaults,
    };
    const emptyTitle: TemplateDraft = {
        ...server,
        columns: [...server.columns, { id: 'd', title: '', color: 'amber' }],
    };
    const duplicate: TemplateDraft = {
        ...server,
        columns: [
            ...server.columns,
            { id: 'd', title: ` ${t('stop')} `, color: 'amber' },
        ],
    };
    const meta = {
        editedBy: 'Inès',
        editedAt: t('2 days ago'),
        usedByTeams: 3,
    };

    return (
        <div className="flex max-w-240 flex-col gap-8 p-6">
            <State
                label={t(
                    'Colour picker open (the six colours the server stores; two are used by another column)',
                )}
            >
                <OpenPicker />
            </State>
            <State
                label={t(
                    'Colour picker content: eight design colours, six server colours, a long column title',
                )}
            >
                <div className="flex flex-wrap items-start gap-4">
                    <Options colors={columnColors} title={t('Ideas')} />
                    <Options
                        colors={serverColumnColors}
                        title={t('Ideas')}
                        usedBy={{ slate: t('Continue') }}
                    />
                    <Options
                        colors={serverColumnColors}
                        title={ten.columns[0].title}
                    />
                </div>
            </State>
            <State
                label={t(
                    'Edit a workspace template: name, category and columns, as the server stores them',
                )}
            >
                <Editor
                    initial={server}
                    categories={categories}
                    onDelete={() => undefined}
                />
            </State>
            <State
                label={t(
                    'Create: start from a built-in template (pick one to load its columns)',
                )}
            >
                <StartFromEditor />
            </State>
            <State
                label={t(
                    'With the optional parts: description, visibility, default settings, eight colours, meta line',
                )}
            >
                <Editor
                    initial={full}
                    colors={columnColors}
                    meta={meta}
                    onDuplicate={() => undefined}
                    onDelete={() => undefined}
                />
            </State>
            <State
                label={t('Create: empty name and one column, no footer extras')}
            >
                <Editor mode="create" initial={empty} colors={columnColors} />
            </State>
            <State label={t('Empty column title (press Save to see it)')}>
                <Editor
                    initial={emptyTitle}
                    categories={categories}
                    onDelete={() => undefined}
                />
            </State>
            <State
                label={t('Duplicate column title (leave the field to see it)')}
            >
                <Editor initial={duplicate} categories={categories} />
            </State>
            <State label={t('Server errors on every field, and the summary')}>
                <Editor
                    initial={server}
                    categories={categories}
                    errors={{
                        name: t('A template with this name already exists.'),
                        category: t('The selected category is invalid.'),
                        columns: t(
                            'A template cannot have more than 10 columns.',
                        ),
                        'columns.1.title': t('This title is too long.'),
                        'columns.1.description': t(
                            'This description is too long.',
                        ),
                        'columns.2.color': t('The selected colour is invalid.'),
                    }}
                />
            </State>
            <State
                label={t(
                    'Dragging: drag a handle, or Space then arrow keys (interactive)',
                )}
            >
                <Editor initial={server} categories={categories} />
            </State>
            <State
                label={t(
                    'Ten columns reached, 100-character titles, long French labels: Add is disabled',
                )}
            >
                <Editor initial={ten} categories={categories} />
            </State>
            <State label={t('Saving')}>
                <Editor initial={server} categories={categories} saving />
            </State>
            <State label={t('Workspace sharing not allowed')}>
                <Editor
                    initial={full}
                    colors={columnColors}
                    canShareWorkspace={false}
                />
            </State>
            <State label={t('Narrow container (20rem): stacked layout')}>
                <div className="w-80 max-w-full">
                    <Editor
                        initial={ten}
                        categories={categories}
                        onDuplicate={() => undefined}
                        onDelete={() => undefined}
                    />
                </div>
            </State>
        </div>
    );
}
