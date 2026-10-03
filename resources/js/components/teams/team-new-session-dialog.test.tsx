import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { TeamNewSessionDialog } from '@/components/teams/team-new-session-dialog';
import { Button } from '@/components/ui/button';
import { renderWithProviders } from '@/test/render';
import type { NewSessionOptions } from '@/types';

const mocks = vi.hoisted(() => ({
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
        currentWorkspace: { role: 'member' } as { role: string } | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        router: {
            post: vi.fn(),
            reload: vi.fn(),
            replace: vi.fn(),
            on: vi.fn(() => () => {}),
        },
    };
});

const options: NewSessionOptions = {
    templateCategories: [],
    topTemplates: [],
    llm: { enabled: false, provider: null },
    canCreateRetro: true,
    icebreakerGames: [],
    gameOptions: [],
    canCreateGameRoom: true,
    roomLimit: 20,
    pokerDecks: [],
    defaultPokerDeck: { deck: null, savedDeckId: null },
    pokerDeckOptions: [],
    canCreatePokerGame: true,
    pokerSources: [],
    canCreateWhiteboard: true,
    surveys: [],
    canCreateSurvey: true,
    surveyTemplates: [],
};

const workspace = { id: 'w', name: 'Nordlys', slug: 'nordlys' };
const team = { id: 'team-1', name: 'Atlas' };

function WithIntent(props: { options: NewSessionOptions }) {
    const intent = useNewSessionIntent();

    return (
        <TeamNewSessionDialog
            workspace={workspace}
            team={team}
            options={props.options}
            intent={intent}
            trigger={<Button>New session</Button>}
        />
    );
}

function openDialog(overrides: Partial<NewSessionOptions> = {}) {
    renderWithProviders(
        <TeamNewSessionDialog
            workspace={workspace}
            team={team}
            options={{ ...options, ...overrides }}
            intent={null}
            trigger={<Button>New session</Button>}
        />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    return screen.getByRole('dialog');
}

function offeredTypes(dialog: HTMLElement): (string | undefined)[] {
    return within(
        within(dialog).getByRole('radiogroup', { name: 'Session type' }),
    )
        .getAllByRole('radio')
        .map((radio) => radio.dataset.type);
}

afterEach(() => {
    window.history.replaceState(null, '', '/');
});

describe('TeamNewSessionDialog', () => {
    it('offers the five kinds in the order Retro, Poker, Whiteboard, Poll, Icebreaker to who may create them all', () => {
        expect(offeredTypes(openDialog())).toEqual([
            'retro',
            'poker',
            'whiteboard',
            'survey',
            'icebreaker',
        ]);
    });

    it('leaves Poker out for who may not create a game', () => {
        expect(offeredTypes(openDialog({ canCreatePokerGame: false }))).toEqual(
            ['retro', 'whiteboard', 'survey', 'icebreaker'],
        );
    });

    it('keeps Poll offered but disabled, with its reason, for who may not create a survey', () => {
        const poll = within(openDialog({ canCreateSurvey: false })).getByRole(
            'radio',
            { name: /Poll/ },
        );

        expect(poll.getAttribute('aria-disabled')).toBe('true');
        expect(poll.textContent).toContain(
            'You cannot create a survey in this team.',
        );
    });

    it('opens on the poker form when the address asks for ?new=poker', () => {
        window.history.replaceState(null, '', '/?new=poker');

        renderWithProviders(<WithIntent options={options} />);

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog)
                .getByRole('radio', { name: /Planning poker/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('offers "Save as team template" to a workspace manager only', () => {
        openDialog();

        expect(screen.queryByLabelText('Save as team template')).toBeNull();
    });

    it('lets a workspace admin save the columns as a team template', () => {
        mocks.props.currentWorkspace = { role: 'admin' };

        openDialog();

        expect(screen.getByLabelText('Save as team template')).toBeTruthy();

        mocks.props.currentWorkspace = { role: 'member' };
    });
});
