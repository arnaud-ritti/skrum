import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import {
    RetroSessionFields,
    retroSessionForm,
} from '@/components/teams/session-create/retro-session-fields';
import type { RetroSessionFormProps } from '@/components/teams/session-create/retro-session-fields';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { CatalogueTemplate } from '@/types';

export const group: BenchGroup = 'layouts';

/** Template and column names come from the server, already in the user's language: they are not translated here. */
const catalogue: CatalogueTemplate[] = [
    {
        key: 'workspace:0199a000-0000-7000-8000-00000000a001',
        name: 'Atlas retro v3',
        category: 'essentials',
        isCommon: false,
        isWorkspace: true,
        columns: [
            { title: 'Keep', description: null, color: 'green' },
            { title: 'Drop', description: null, color: 'red' },
            { title: 'Try', description: null, color: 'purple' },
        ],
    },
    {
        key: 'custom',
        name: 'Custom',
        category: null,
        isCommon: false,
        isWorkspace: false,
        columns: [],
    },
    {
        key: 'start_stop_continue',
        name: 'Start, Stop, Continue',
        category: 'essentials',
        isCommon: true,
        isWorkspace: false,
        columns: [
            {
                title: 'Start',
                description: 'What should we begin?',
                color: 'green',
            },
            {
                title: 'Stop',
                description: 'What slows us down?',
                color: 'red',
            },
            {
                title: 'Continue',
                description: 'What works well?',
                color: 'blue',
            },
        ],
    },
    {
        key: 'four_ls',
        name: '4Ls',
        category: 'essentials',
        isCommon: true,
        isWorkspace: false,
        columns: [
            { title: 'Liked', description: null, color: 'green' },
            { title: 'Learned', description: null, color: 'amber' },
            { title: 'Lacked', description: null, color: 'slate' },
            { title: 'Longed for', description: null, color: 'purple' },
        ],
    },
    {
        key: 'mad_sad_glad',
        name: 'Mad, Sad, Glad',
        category: 'team_mood',
        isCommon: true,
        isWorkspace: false,
        columns: [
            { title: 'Mad', description: null, color: 'red' },
            { title: 'Sad', description: null, color: 'blue' },
            { title: 'Glad', description: null, color: 'amber' },
        ],
    },
    {
        key: 'sailboat',
        name: 'Sailboat',
        category: 'themed',
        isCommon: false,
        isWorkspace: false,
        columns: [
            {
                title: 'What is the wind pushing our sails that makes us go fast?',
                description: 'Everything that helps the team move forward',
                color: 'green',
            },
            {
                title: 'What anchors are holding us back?',
                description: 'What slows us down and adds drag every sprint',
                color: 'red',
            },
            {
                title: 'What rocks are ahead of us?',
                description: null,
                color: 'amber',
            },
            {
                title: 'What is our ideal island destination?',
                description: null,
                color: 'blue',
            },
        ],
    },
];

const formProps: RetroSessionFormProps = {
    workspaceSlug: 'nordlys',
    categories: [
        { value: 'essentials', label: 'Essentials' },
        { value: 'team_mood', label: 'Team & mood' },
        { value: 'themed', label: 'Themed & fun' },
    ],
    catalogue,
    topTemplates: [
        'start_stop_continue',
        'four_ls',
        'mad_sad_glad',
        'sailboat',
        'workspace:0199a000-0000-7000-8000-00000000a001',
    ],
    llm: { enabled: true, provider: 'Anthropic' },
    icebreakerGames: [
        { value: 'draw', label: 'Draw & Guess', available: true },
        { value: 'hangman', label: 'Hangman', available: true },
    ],
    canSaveTemplate: true,
    initialTitle: 'Sprint 43 retro',
};

const team = { id: 'atlas', name: 'Atlas' };

function WholeForm() {
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    return (
        <div
            data-slot="session-create-whole"
            className="max-w-244 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card"
        >
            <RetroSessionFields
                {...formProps}
                context={{
                    type: 'retro',
                    formId: 'bench-retro-form',
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

export default function SessionCreateSection() {
    const { t } = useTrans();

    return (
        <div
            data-bench-section="session-create"
            className="flex flex-col gap-6 p-4 md:p-6"
        >
            <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                    {t('New session, retro form: the whole form, not scrolled')}
                </p>
                <WholeForm />
            </div>
            <BenchOverlayStage>
                <p className="text-xs text-muted-foreground">
                    {t('New session dialog, open on the retro type')}
                </p>
                <NewSessionDialog
                    trigger={<Button>{t('New session')}</Button>}
                    team={team}
                    intent={{ type: 'retro' }}
                    retro={retroSessionForm(formProps)}
                />
            </BenchOverlayStage>
        </div>
    );
}
