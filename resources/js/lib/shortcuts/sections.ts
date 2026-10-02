import { Armchair, Keyboard, PenTool, Smile, Spade } from 'lucide-react';
import type {
    Shortcut,
    ShortcutSection,
    ShortcutSectionId,
} from '@/components/skrum/keyboard-shortcuts';
import { DefaultQuickEmojis } from '@/components/skrum/reaction-bar';

const Contexts: Record<string, ShortcutSectionId> = {
    'retros/show': 'retro',
    'poker/show': 'poker',
    'whiteboards/show': 'whiteboard',
};

export type ShortcutSurface = {
    /** The command palette is on screen: `mod+K` and `/` open it. */
    palette?: boolean;
    /** The application sidebar is on screen: `mod+B` folds it. */
    sidebar?: boolean;
};

export function contextOfPage(
    component: string,
): ShortcutSectionId | undefined {
    return Contexts[component];
}

/**
 * The shortcuts that have a handler in the application, the five of spec B35
 * included. One list feeds the dialog; a shortcut without a handler is not
 * listed, and neither is one
 * whose control is absent from the screen (a session has no palette, a guest
 * no sidebar).
 */
export function shortcutSections(
    t: (key: string) => string,
    { palette = true, sidebar = true }: ShortcutSurface = {},
): ShortcutSection[] {
    const general: (Shortcut | null)[] = [
        palette
            ? { id: 'palette', label: t('Command palette'), keys: ['mod', 'K'] }
            : null,
        palette ? { id: 'search', label: t('Search'), keys: ['/'] } : null,
        { id: 'shortcuts', label: t('Keyboard shortcuts'), keys: ['?'] },
        sidebar
            ? {
                  id: 'sidebar',
                  label: t('Toggle the sidebar'),
                  keys: ['mod', 'B'],
              }
            : null,
    ];

    return [
        {
            id: 'general',
            title: t('General'),
            icon: Keyboard,
            items: general.filter((item) => item !== null),
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
                {
                    id: 'group',
                    label: t('Group with another card'),
                    keys: ['G'],
                },
                {
                    id: 'focus',
                    label: t('Focus the selected card'),
                    keys: ['F'],
                    facilitatorOnly: true,
                },
                {
                    id: 'next-phase',
                    label: t('Next phase'),
                    keys: ['mod', 'ArrowRight'],
                    facilitatorOnly: true,
                },
                {
                    id: 'timer',
                    label: t('Pause or resume the timer'),
                    keys: ['T'],
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
                { id: 'coffee', label: t('Coffee break'), keys: ['C'] },
                {
                    id: 'reveal',
                    label: t('Reveal cards'),
                    keys: ['R'],
                    facilitatorOnly: true,
                },
                {
                    id: 'revote',
                    label: t('Re-vote'),
                    keys: ['shift', 'R'],
                    facilitatorOnly: true,
                },
                {
                    id: 'accept',
                    label: t('Save estimate'),
                    keys: ['mod', 'Enter'],
                    facilitatorOnly: true,
                },
                {
                    id: 'next-task',
                    label: t('Next task'),
                    keys: ['N'],
                    facilitatorOnly: true,
                },
                { id: 'settings', label: t('Session settings'), keys: [','] },
            ],
        },
        {
            id: 'whiteboard',
            title: t('Whiteboard'),
            icon: PenTool,
            items: [],
            note: t('The whiteboard uses the shortcuts of its own toolbar.'),
        },
        {
            id: 'reactions',
            title: t('Reactions'),
            icon: Smile,
            note: t(
                'The poker deck, the ROTI, the health check and a survey take the digits while they have the focus.',
            ),
            items: DefaultQuickEmojis.map((emoji, index) => ({
                id: `reaction-${index + 1}`,
                label: emoji,
                keys: [String(index + 1)],
            })),
        },
    ];
}
