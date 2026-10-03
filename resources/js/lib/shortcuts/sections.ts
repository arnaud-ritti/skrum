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
    /**
     * The cards of the poker game on screen: the keys of the "?" and coffee
     * cards are listed only when the deck holds them. Outside a game both are.
     */
    deck?: readonly string[];
};

const UnknownCard = '?';
const CoffeeCard = '☕';

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
    { palette = true, sidebar = true, deck }: ShortcutSurface = {},
): ShortcutSection[] {
    const hasCard = (card: string) => deck === undefined || deck.includes(card);
    const reactions = t('Reactions');
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
                    id: 'discussed',
                    label: t('Mark as discussed'),
                    keys: ['D'],
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
                ...(hasCard(UnknownCard)
                    ? [
                          {
                              id: 'unknown',
                              label: t('Play the “?” card'),
                              keys: ['?'],
                          },
                      ]
                    : []),
                ...(hasCard(CoffeeCard)
                    ? [
                          {
                              id: 'coffee',
                              label: t('Coffee break'),
                              keys: ['C'],
                          },
                      ]
                    : []),
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
            items: [
                { id: 'select', label: t('Selection'), keys: ['V'] },
                { id: 'hand', label: t('Hand'), keys: ['H'] },
                { id: 'sticky', label: t('Sticky note'), keys: ['N'] },
                { id: 'shape', label: t('Shape'), keys: ['R'] },
                { id: 'connector', label: t('Connector'), keys: ['C'] },
                { id: 'text', label: t('Text'), keys: ['T'] },
                { id: 'pencil', label: t('Pencil'), keys: ['P'] },
                { id: 'eraser', label: t('Eraser'), keys: ['E'] },
                { id: 'frame', label: t('Frame'), keys: ['F'] },
                { id: 'minimap', label: t('Minimap'), keys: ['M'] },
                { id: 'fit', label: t('Fit to screen'), keys: ['shift', '1'] },
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
            title: reactions,
            icon: Smile,
            note: t(
                'The poker deck, the ROTI, the health check and a survey take the digits while they have the focus.',
            ),
            items: DefaultQuickEmojis.map((emoji, index) => ({
                id: `reaction-${index + 1}`,
                label: emoji,
                keys: [String(index + 1)],
                keywords: [reactions],
            })),
        },
    ];
}
