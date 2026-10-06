import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
        auth: { user: { id: 'me' } },
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
    canSaveTemplate: false,
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
    currentSprintNumber: null,
    defaultRetroTemplate: null,
    retroFacilitators: [],
    suggestedFacilitatorId: null,
    facilitatorRotation: false,
};

const workspace = { id: 'w', name: 'Nordlys', slug: 'nordlys' };

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});
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

    it('opens the retro form on the sprint, the suggested facilitator and the viewer as "Me"', async () => {
        const dialog = openDialog({
            currentSprintNumber: 7,
            retroFacilitators: [
                { id: 'camille', name: 'Camille Roux', avatarUrl: '' },
                { id: 'me', name: 'Mia Lopez', avatarUrl: '' },
            ],
            suggestedFacilitatorId: 'camille',
            facilitatorRotation: true,
        });

        expect(
            (within(dialog).getByLabelText('Name') as HTMLInputElement).value,
        ).toBe('Sprint 7 retro');
        expect(
            within(dialog)
                .getByRole('combobox', { name: 'Facilitator' })
                .querySelector('.truncate')?.textContent,
        ).toBe('Camille Roux (suggested)');
        expect(
            within(dialog).getByText('Suggested by the rotation.'),
        ).toBeTruthy();

        await userEvent.click(
            within(dialog).getByRole('combobox', { name: 'Facilitator' }),
        );

        expect(
            screen
                .getAllByRole('option')
                .map(
                    (option) => option.querySelector('.truncate')?.textContent,
                ),
        ).toEqual(['Me', 'Camille Roux (suggested)']);
    });

    it('hides "Save as team template" when the server says the viewer may not share one', () => {
        openDialog();

        expect(screen.queryByLabelText('Save as team template')).toBeNull();
    });

    it('offers "Save as team template" when the server allows it', () => {
        openDialog({ canSaveTemplate: true });

        expect(screen.getByLabelText('Save as team template')).toBeTruthy();
    });
});
