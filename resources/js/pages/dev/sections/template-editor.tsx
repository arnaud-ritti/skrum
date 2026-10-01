import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ColumnColorPicker } from '@/components/skrum/column-color-picker';
import type { ColumnColor } from '@/components/skrum/column-color-picker';
import { TemplateEditor } from '@/components/skrum/template-editor';
import type {
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
    const defaults: TemplateDraft['defaults'] = {
        votesPerPerson: 5,
        maxPerCard: 2,
        anonymous: true,
        timers: { writing: 5, voting: 3 },
    };

    const base: TemplateDraft = {
        name: t('Start, Stop, Continue'),
        description: t('Three simple columns to look back on the sprint.'),
        visibility: 'team',
        columns: [
            { id: 'a', title: t('Start'), color: 'sky' },
            {
                id: 'b',
                title: t('Stop'),
                help: t('What slowed us down?'),
                color: 'coral',
            },
            { id: 'c', title: t('Continue'), color: 'moss' },
        ],
        defaults,
    };

    const eight: TemplateDraft = {
        ...base,
        columns: [
            'sun',
            'apricot',
            'coral',
            'plum',
            'iris',
            'sky',
            'lagoon',
            'moss',
        ].map((color, index) => ({
            id: `e${index}`,
            title: `${t('Column')} ${index + 1}`,
            color: color as ColumnColor,
        })),
    };

    return { base, eight, defaults };
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

function PickerState({
    defaultOpen,
    usedBy,
}: {
    defaultOpen?: boolean;
    usedBy?: Partial<Record<ColumnColor, string>>;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState<ColumnColor>('sky');

    return (
        <div className="h-80 max-w-88">
            <ColumnColorPicker
                value={value}
                onValueChange={setValue}
                columnTitle={t('Ideas')}
                defaultOpen={defaultOpen}
                usedBy={usedBy}
            />
        </div>
    );
}

export default function TemplateEditorSection() {
    const { t } = useTrans();
    const { base, eight, defaults } = useDrafts();
    const empty: TemplateDraft = {
        name: '',
        visibility: 'personal',
        columns: [{ id: 'n', title: '', color: 'sun' }],
        defaults,
    };
    const emptyTitle: TemplateDraft = {
        ...base,
        columns: [...base.columns, { id: 'd', title: '', color: 'plum' }],
    };
    const duplicate: TemplateDraft = {
        ...base,
        columns: [
            ...base.columns,
            { id: 'd', title: ` ${t('stop')} `, color: 'plum' },
        ],
    };
    const meta = {
        editedBy: 'Inès',
        editedAt: t('2 days ago'),
        usedByTeams: 3,
    };

    return (
        <div className="flex max-w-240 flex-col gap-8 p-6">
            <State label={t('Edit: default')}>
                <Editor
                    initial={base}
                    meta={meta}
                    onDuplicate={() => undefined}
                    onDelete={() => undefined}
                />
            </State>
            <State
                label={t('Create: empty name and one column, no footer extras')}
            >
                <Editor mode="create" initial={empty} />
            </State>
            <State label={t('Empty column title (press Save to see it)')}>
                <Editor initial={emptyTitle} onDelete={() => undefined} />
            </State>
            <State
                label={t('Duplicate column title (leave the field to see it)')}
            >
                <Editor initial={duplicate} />
            </State>
            <State label={t('Server errors and summary')}>
                <Editor
                    initial={base}
                    errors={{
                        name: t(
                            'This name is already used by another template.',
                        ),
                        'columns.1.title': t('This title is too long.'),
                    }}
                />
            </State>
            <State label={t('Colour picker open')}>
                <PickerState defaultOpen />
            </State>
            <State
                label={t(
                    'Colour picker: a colour used by another column (dot and legend)',
                )}
            >
                <PickerState
                    defaultOpen
                    usedBy={{ moss: t('Continue'), coral: t('Stop') }}
                />
            </State>
            <State
                label={t(
                    'Dragging: drag a handle, or Space then arrow keys (interactive)',
                )}
            >
                <Editor initial={base} />
            </State>
            <State label={t('Eight columns reached: Add is disabled')}>
                <Editor initial={eight} />
            </State>
            <State label={t('Saving')}>
                <Editor initial={base} saving />
            </State>
            <State label={t('Workspace sharing not allowed')}>
                <Editor initial={base} canShareWorkspace={false} />
            </State>
            <State label={t('Narrow container (20rem): stacked layout')}>
                <div className="w-80 max-w-full">
                    <Editor
                        initial={base}
                        onDuplicate={() => undefined}
                        onDelete={() => undefined}
                    />
                </div>
            </State>
        </div>
    );
}
