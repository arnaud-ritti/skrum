import { Armchair, Keyboard, PenTool, Smile, Spade } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { useShortcut } from '@/hooks/use-shortcut';
import {
    KeyboardShortcuts,
    KeyboardShortcutsPanel,
    KeyboardShortcutsTrigger,
} from '@/components/skrum/keyboard-shortcuts';
import type {
    Platform,
    ShortcutSection,
} from '@/components/skrum/keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { shortcutSections } from '@/lib/shortcuts/sections';

export const group: BenchGroup = 'skrum';

function useSections(): ShortcutSection[] {
    const { t } = useTrans();

    return [
        {
            id: 'general',
            title: t('General'),
            icon: Keyboard,
            items: [
                {
                    id: 'palette',
                    label: t('Command palette'),
                    keys: ['mod', 'K'],
                },
                {
                    id: 'shortcuts',
                    label: t('Keyboard shortcuts'),
                    keys: ['?'],
                },
                {
                    id: 'sidebar',
                    label: t('Toggle the sidebar'),
                    keys: ['mod', 'B'],
                },
            ],
        },
        {
            id: 'retro',
            title: t('Retrospective'),
            icon: Armchair,
            items: [
                { id: 'new-card', label: t('New card'), keys: ['N'] },
                { id: 'publish', label: t('Publish'), keys: ['Enter'] },
                { id: 'cancel', label: t('Cancel'), keys: ['Escape'] },
                {
                    id: 'vote',
                    label: t('Vote for the selected card'),
                    keys: ['V'],
                    keywords: [t('vote')],
                },
                { id: 'group', label: t('Group cards'), keys: ['G'] },
                {
                    id: 'focus',
                    label: t('Focus on a card'),
                    keys: ['F'],
                    facilitatorOnly: true,
                },
                {
                    id: 'next',
                    label: t('Next phase'),
                    keys: ['mod', 'ArrowRight'],
                    facilitatorOnly: true,
                },
            ],
        },
        {
            id: 'poker',
            title: t('Planning poker'),
            icon: Spade,
            items: [
                {
                    id: 'pick',
                    label: t('Pick a card'),
                    keys: [],
                    range: ['0', '9'],
                    keywords: [t('vote'), t('estimate')],
                },
                { id: 'question', label: t('Play the “?” card'), keys: ['?'] },
                { id: 'coffee', label: t('Coffee break'), keys: ['C'] },
                {
                    id: 'reveal',
                    label: t('Reveal the cards'),
                    keys: ['R'],
                    facilitatorOnly: true,
                },
                {
                    id: 'revote',
                    label: t('Vote again'),
                    keys: ['shift', 'R'],
                    facilitatorOnly: true,
                },
                {
                    id: 'next-task',
                    label: t('Next task'),
                    keys: ['N'],
                    facilitatorOnly: true,
                },
            ],
        },
        {
            id: 'whiteboard',
            title: t('Whiteboard'),
            icon: PenTool,
            items: [
                { id: 'select', label: t('Select'), keys: ['V'] },
                { id: 'hand', label: t('Hand'), keys: ['H'] },
                { id: 'sticky', label: t('Sticky note'), keys: ['N'] },
                { id: 'shape', label: t('Shape'), keys: ['S'] },
                { id: 'text', label: t('Text'), keys: ['T'] },
                { id: 'pencil', label: t('Pencil'), keys: ['P'] },
                { id: 'connector', label: t('Connector'), keys: ['C'] },
                {
                    id: 'pan',
                    label: t('Pan'),
                    keys: ['Space'],
                    suffix: t('+ drag'),
                },
                { id: 'undo', label: t('Undo'), keys: ['mod', 'Z'] },
                { id: 'redo', label: t('Redo'), keys: ['shift', 'mod', 'Z'] },
                { id: 'zoom-in', label: t('Zoom in'), keys: ['mod', '+'] },
                { id: 'zoom-out', label: t('Zoom out'), keys: ['mod', '−'] },
            ],
        },
        {
            id: 'reactions',
            title: t('Reactions'),
            icon: Smile,
            note: t('Disabled in planning poker, where digits vote.'),
            items: ['👍', '❤️', '👏', '🎉', '🤔', '👎'].map((emoji, index) => ({
                id: `reaction-${index + 1}`,
                label: emoji,
                keys: [String(index + 1)],
            })),
        },
    ];
}

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Launcher({
    label,
    initialPlatform,
    initialQuery,
    context,
    withPalette,
    opensWithQuestionMark,
    defaultOpen = false,
}: {
    label: string;
    initialPlatform?: Platform;
    initialQuery?: string;
    context?: ShortcutSection['id'];
    withPalette?: boolean;
    opensWithQuestionMark?: boolean;
    defaultOpen?: boolean;
}) {
    const sections = useSections();
    const [open, setOpen] = useState(defaultOpen);
    const [platform, setPlatform] = useState<Platform | undefined>(
        initialPlatform,
    );
    const [query, setQuery] = useState(initialQuery ?? '');

    useShortcut('?', () => setOpen(true), { enabled: opensWithQuestionMark });

    return (
        <>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(true)}
                >
                    <span className="truncate">{label}</span>
                </Button>
                <KeyboardShortcutsTrigger onClick={() => setOpen(true)} />
            </div>
            <KeyboardShortcuts
                open={open}
                onOpenChange={setOpen}
                sections={sections}
                context={context}
                platform={platform}
                onPlatformChange={setPlatform}
                query={query}
                onQueryChange={setQuery}
                onOpenCommandPalette={
                    withPalette ? () => setOpen(false) : undefined
                }
            />
        </>
    );
}

function InlinePanel({
    initialPlatform,
    initialQuery,
    context,
    withPalette,
}: {
    initialPlatform: Platform;
    initialQuery?: string;
    context?: ShortcutSection['id'];
    withPalette?: boolean;
}) {
    const sections = useSections();
    const [platform, setPlatform] = useState<Platform>(initialPlatform);
    const [query, setQuery] = useState(initialQuery ?? '');

    return (
        <KeyboardShortcutsPanel
            sections={sections}
            context={context}
            platform={platform}
            onPlatformChange={setPlatform}
            query={query}
            onQueryChange={setQuery}
            onOpenCommandPalette={withPalette ? () => undefined : undefined}
            className="w-full max-w-190"
        />
    );
}

export default function KeyboardShortcutsSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Default, macOS')}>
                <InlinePanel initialPlatform="mac" />
            </Example>
            <Example label={t('Windows · Linux')}>
                <InlinePanel initialPlatform="other" />
            </Example>
            <Example label={t('Poker context first')}>
                <InlinePanel initialPlatform="mac" context="poker" />
            </Example>
            <Example label={t('Filtered search')}>
                <InlinePanel initialPlatform="mac" initialQuery={t('vote')} />
            </Example>
            <Example label={t('No result')}>
                <InlinePanel
                    initialPlatform="mac"
                    initialQuery={t('export')}
                    withPalette
                />
            </Example>
            <Example label={t('Wired in the application')}>
                <KeyboardShortcutsPanel
                    sections={shortcutSections(t)}
                    className="w-full max-w-190"
                />
            </Example>
            <BenchOverlayStage>
                <Example
                    label={t('Dialog, open (opens with ? outside a field)')}
                >
                    <Launcher
                        label={t('Open the shortcuts')}
                        initialPlatform="mac"
                        opensWithQuestionMark
                        defaultOpen
                    />
                </Example>
            </BenchOverlayStage>
        </div>
    );
}
