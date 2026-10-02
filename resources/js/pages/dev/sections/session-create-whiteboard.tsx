import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import {
    WhiteboardSessionFields,
    whiteboardSessionForm,
} from '@/components/teams/session-create/whiteboard-session-fields';
import type { WhiteboardSessionFormProps } from '@/components/teams/session-create/whiteboard-session-fields';
import { WhiteboardTemplatesManager } from '@/components/teams/whiteboard-templates-dialog';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    WhiteboardGalleryItem,
    WhiteboardPreviewShape,
    WhiteboardTemplateSummary,
} from '@/types';

export const group: BenchGroup = 'layouts';

/** Scene colours are canvas data, as the server sends them in a preview. */
const Ink = '#1e1e1e';
const Sun = '#fdf1c2';
const Sky = '#e2f3ff';
const Moss = '#e1f8dc';
const Coral = '#ffebe8';

function shape(
    kind: WhiteboardPreviewShape['kind'],
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string | null = null,
    stroke: string | null = Ink,
    points: [number, number][] = [],
): WhiteboardPreviewShape {
    return { kind, x, y, width, height, fill, stroke, points };
}

function frames(columns: number, rows: number): WhiteboardPreviewShape[] {
    const width = 600 / columns;
    const height = 360 / rows;

    return Array.from({ length: columns * rows }, (_, index) =>
        shape(
            'rect',
            (index % columns) * width + 8,
            Math.floor(index / columns) * height + 8,
            width - 16,
            height - 16,
        ),
    );
}

function notes(
    columns: number,
    rows: number,
    fills: string[],
): WhiteboardPreviewShape[] {
    const width = 600 / columns;
    const height = 360 / rows;

    return fills.flatMap((fill, index) => [
        shape(
            'rect',
            (index % columns) * width + 28,
            Math.floor(index / columns) * height + 48,
            90,
            70,
            fill,
            null,
        ),
        shape(
            'text',
            (index % columns) * width + 28,
            Math.floor(index / columns) * height + 22,
            80,
            10,
        ),
    ]);
}

const board = { width: 600, height: 360 };

/** Template names come from the server, already in the user's language: they are not translated here. */
const gallery: WhiteboardGalleryItem[] = [
    {
        key: 'blank',
        workspaceTemplateId: null,
        name: 'Blank',
        description: 'An empty canvas.',
        preview: { width: 1, height: 1, shapes: [] },
    },
    {
        key: 'brainstorm',
        workspaceTemplateId: null,
        name: 'Brainstorm',
        description: 'Three areas to collect, sort and keep ideas.',
        preview: {
            ...board,
            shapes: [...frames(3, 1), ...notes(3, 1, [Sun, Sky, Moss])],
        },
    },
    {
        key: 'flowchart',
        workspaceTemplateId: null,
        name: 'Flowchart',
        description: 'Start, steps, decisions and end, with a legend.',
        preview: {
            ...board,
            shapes: [
                shape('ellipse', 20, 140, 100, 80),
                shape('rect', 180, 140, 110, 80),
                shape('diamond', 350, 120, 110, 120),
                shape('ellipse', 500, 30, 90, 70),
                shape('rect', 500, 260, 90, 70),
                shape('path', 120, 180, 60, 0, null, Ink, [
                    [120, 180],
                    [180, 180],
                ]),
                shape('path', 290, 180, 60, 0, null, Ink, [
                    [290, 180],
                    [350, 180],
                ]),
                shape('path', 460, 180, 40, 115, null, Ink, [
                    [460, 180],
                    [545, 180],
                    [545, 260],
                ]),
            ],
        },
    },
    {
        key: 'user_story_map',
        workspaceTemplateId: null,
        name: 'User story map',
        description: 'Activities, steps and stories, release by release.',
        preview: {
            ...board,
            shapes: [...frames(1, 3), ...notes(1, 3, [Sky, Sun, Moss])],
        },
    },
    {
        key: 'impact_map',
        workspaceTemplateId: null,
        name: 'Impact map',
        description: 'Goal, actors, impacts and deliverables.',
        preview: {
            ...board,
            shapes: [...frames(4, 1), ...notes(4, 1, [Coral, Sun, Sky, Moss])],
        },
    },
    {
        key: 'swot',
        workspaceTemplateId: null,
        name: 'SWOT',
        description: 'Strengths, weaknesses, opportunities and threats.',
        preview: {
            ...board,
            shapes: [...frames(2, 2), ...notes(2, 2, [Moss, Coral, Sky, Sun])],
        },
    },
    {
        key: 'lean_canvas',
        workspaceTemplateId: null,
        name: 'Lean canvas',
        description: 'The nine blocks of a business model on one page.',
        preview: { ...board, shapes: frames(3, 3) },
    },
    {
        key: 'matrix',
        workspaceTemplateId: null,
        name: '2×2 matrix',
        description: 'Two axes to place and compare options.',
        preview: {
            ...board,
            shapes: [
                ...frames(2, 2),
                shape('path', 300, 0, 0, 360, null, Ink, [
                    [300, 0],
                    [300, 360],
                ]),
                shape('path', 0, 180, 600, 0, null, Ink, [
                    [0, 180],
                    [600, 180],
                ]),
            ],
        },
    },
    {
        key: 'workspace:0199a000-0000-7000-8000-00000000b001',
        workspaceTemplateId: '0199a000-0000-7000-8000-00000000b001',
        name: 'Kick-off map of the Nordlys platform programme',
        description:
            'How we start a project: goals, people, risks and the first three weeks, on one board.',
        preview: {
            ...board,
            shapes: [
                shape('rect', 20, 20, 260, 320),
                shape('ellipse', 340, 40, 220, 120),
                shape('rect', 360, 220, 90, 70, Sun, null),
                shape('rect', 470, 220, 90, 70, Sky, null),
            ],
        },
    },
    {
        key: 'workspace:0199a000-0000-7000-8000-00000000b002',
        workspaceTemplateId: '0199a000-0000-7000-8000-00000000b002',
        name: 'Incident review',
        description: null,
        preview: { ...board, shapes: frames(2, 1) },
    },
];

const templates: WhiteboardTemplateSummary[] = [
    {
        id: '0199a000-0000-7000-8000-00000000b002',
        name: 'Incident review',
        description: null,
        canManage: true,
    },
    {
        id: '0199a000-0000-7000-8000-00000000b001',
        name: 'Kick-off map of the Nordlys platform programme',
        description:
            'How we start a project: goals, people, risks and the first three weeks, on one board.',
        canManage: true,
    },
    {
        id: '0199a000-0000-7000-8000-00000000b003',
        name: 'Quarterly roadmap',
        description: 'Kept by the product team.',
        canManage: false,
    },
    {
        id: '0199a000-0000-7000-8000-00000000b004',
        name: 'Team charter',
        description: 'Values, rituals and working agreements.',
        canManage: true,
    },
];

const formProps: WhiteboardSessionFormProps = {
    workspaceSlug: 'nordlys',
    gallery,
    initialTitle: 'Q4 architecture',
};

const team = { id: 'atlas', name: 'Atlas' };

function WholeForm({
    name,
    ...props
}: Partial<WhiteboardSessionFormProps> & { name: string }) {
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    return (
        <div
            data-slot="session-create-whole"
            data-state={name}
            className="max-w-244 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card"
        >
            <WhiteboardSessionFields
                {...formProps}
                {...props}
                context={{
                    type: 'whiteboard',
                    formId: `bench-whiteboard-form-${name}`,
                    team,
                    intent: null,
                    active: true,
                    footer,
                    close: () => {},
                }}
            />
            <div
                ref={setFooter}
                className="flex flex-wrap items-center gap-2 border-t px-4 py-3 md:px-6 md:py-4"
            />
        </div>
    );
}

function ManagerPanel({
    name,
    list,
    editingId,
}: {
    name: string;
    list: WhiteboardTemplateSummary[];
    editingId?: string;
}) {
    return (
        <div
            data-slot="whiteboard-templates-panel"
            data-state={name}
            className="grid max-w-lg gap-4 rounded-xl border bg-popover p-6 text-popover-foreground shadow-card"
        >
            <WhiteboardTemplatesManager
                workspaceSlug="nordlys"
                templates={list}
                initialEditingId={editingId}
            />
        </div>
    );
}

export default function SessionCreateWhiteboardSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="session-create-whiteboard"
            className="flex flex-col gap-6 p-4 md:p-6"
        >
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t(
                        'New session, whiteboard form: the whole form, not scrolled',
                    )}
                </p>
                <WholeForm name="gallery" />
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Whiteboard templates manager: the rows, one being edited',
                    )}
                </p>
                <ManagerPanel
                    name="rows"
                    list={templates}
                    editingId="0199a000-0000-7000-8000-00000000b004"
                />
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t('Whiteboard templates manager: no template')}
                </p>
                <ManagerPanel name="empty" list={[]} />
            </div>
            <BenchOverlayStage>
                <p className="text-xs text-muted-foreground">
                    {t('New session dialog, open on the whiteboard type')}
                </p>
                <NewSessionDialog
                    trigger={<Button>{t('New session')}</Button>}
                    team={team}
                    intent={{ type: 'whiteboard' }}
                    whiteboard={whiteboardSessionForm(formProps)}
                />
            </BenchOverlayStage>
        </div>
    );
}
