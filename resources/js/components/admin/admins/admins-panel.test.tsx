import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { AdminsPanel } from '@/components/admin/admins/admins-panel';
import type { InstanceAdmin } from '@/components/admin/admins/types';
import { RetroRequestError } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    retroRequest: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {} } }),
        router: {
            post: mocks.post,
            delete: mocks.delete,
            reload: mocks.reload,
        },
    };
});

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.retroRequest,
}));

type VisitCallbacks = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const CandidateSearchDelayMs = 300;

const ada: InstanceAdmin = {
    id: '0199a000-0000-7000-8000-000000000001',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    avatarUrl: '/avatars/a.svg',
    isSelf: true,
    canRevoke: true,
};

const grace: InstanceAdmin = {
    id: '0199a000-0000-7000-8000-000000000002',
    name: 'Grace Hopper',
    email: 'grace@example.com',
    avatarUrl: '/avatars/b.svg',
    isSelf: false,
    canRevoke: true,
};

const hedy = {
    id: '0199a000-0000-7000-8000-000000000003',
    name: 'Hedy Lamarr',
    email: 'hedy@example.com',
    avatarUrl: '/avatars/c.svg',
};

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.delete.mockReset();
    mocks.reload.mockReset();
    mocks.retroRequest.mockReset();
    mocks.retroRequest.mockResolvedValue({ candidates: [hedy] });
});

afterEach(() => {
    vi.useRealTimers();
});

function openSearch(): HTMLInputElement {
    fireEvent.click(screen.getByRole('combobox', { name: 'Member' }));

    return screen.getByPlaceholderText<HTMLInputElement>('Search…');
}

async function wait(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('AdminsPanel search', () => {
    it('asks for at least two characters and sends nothing before', async () => {
        vi.useFakeTimers();
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        const input = openSearch();

        expect(
            screen.getByText('Type at least 2 characters to search.'),
        ).toBeTruthy();

        fireEvent.change(input, { target: { value: 'h' } });
        await wait(CandidateSearchDelayMs * 2);

        expect(mocks.retroRequest).not.toHaveBeenCalled();
        expect(
            screen.getByText('Type at least 2 characters to search.'),
        ).toBeTruthy();
    });

    it('waits for the typing to pause, then sends one request for the last query', async () => {
        vi.useFakeTimers();
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        const input = openSearch();

        fireEvent.change(input, { target: { value: 'he' } });
        await wait(CandidateSearchDelayMs - 1);
        fireEvent.change(input, { target: { value: 'hed' } });
        await wait(CandidateSearchDelayMs - 1);

        expect(mocks.retroRequest).not.toHaveBeenCalled();
        expect(screen.getByText('Searching…')).toBeTruthy();

        await wait(1);

        expect(mocks.retroRequest).toHaveBeenCalledTimes(1);
        expect(mocks.retroRequest.mock.calls[0][0]).toMatchObject({
            url: '/admin/admins/candidates?query=hed',
            method: 'get',
        });
        expect(
            screen.getByRole('option', { name: /Hedy Lamarr/ }),
        ).toBeTruthy();
    });

    it('says when nobody matches', async () => {
        vi.useFakeTimers();
        mocks.retroRequest.mockResolvedValue({ candidates: [] });
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        fireEvent.change(openSearch(), { target: { value: 'zz' } });
        await wait(CandidateSearchDelayMs);

        expect(screen.getByText('No member matches this search.')).toBeTruthy();
    });

    it('says when the search fails', async () => {
        vi.useFakeTimers();
        mocks.retroRequest.mockRejectedValue(new Error('down'));
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        fireEvent.change(openSearch(), { target: { value: 'he' } });
        await wait(CandidateSearchDelayMs);

        expect(
            screen.getByText(
                'The search is unavailable. Try again in a moment.',
            ),
        ).toBeTruthy();
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    it('reloads the page when the password confirmation has expired, so the server asks for it again', async () => {
        vi.useFakeTimers();
        mocks.retroRequest.mockRejectedValue(
            new RetroRequestError(423, 'Password confirmation required.'),
        );
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        fireEvent.change(openSearch(), { target: { value: 'he' } });
        await wait(CandidateSearchDelayMs);

        expect(mocks.reload).toHaveBeenCalledOnce();
        expect(
            screen.queryByText(
                'The search is unavailable. Try again in a moment.',
            ),
        ).toBeNull();
    });
});

describe('AdminsPanel grant', () => {
    async function chooseHedy(): Promise<void> {
        vi.useFakeTimers();
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        fireEvent.change(openSearch(), { target: { value: 'he' } });
        await wait(CandidateSearchDelayMs);
        fireEvent.click(screen.getByRole('option', { name: /Hedy Lamarr/ }));
    }

    it('keeps the grant button disabled until a member is chosen', () => {
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        expect(
            screen.getByRole<HTMLButtonElement>('button', {
                name: 'Grant admin rights',
            }).disabled,
        ).toBe(true);
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('posts the id of the chosen member', async () => {
        await chooseHedy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Grant admin rights' }),
        );

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe('/admin/admins');
        expect(mocks.post.mock.calls[0][1]).toEqual({ user_id: hedy.id });
    });

    it('shows the refusal of the server next to the field', async () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitCallbacks) => {
                options.onError?.({ user_id: 'The selected user is invalid.' });
                options.onFinish?.();
            },
        );
        await chooseHedy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Grant admin rights' }),
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'The selected user is invalid.',
        );
    });
});

describe('AdminsPanel revoke', () => {
    function askToRevoke(admin: InstanceAdmin): void {
        fireEvent.click(
            screen.getByRole('button', {
                name: `Revoke admin rights of ${admin.name}`,
            }),
        );
    }

    function confirm(): void {
        fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    }

    it('asks before revoking and sends nothing until confirmed', () => {
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(grace);

        const dialog = screen.getByRole('alertdialog');

        expect(dialog.textContent).toContain(
            'Revoke admin rights of Grace Hopper?',
        );
        expect(dialog.textContent).toContain(
            'Grace Hopper will lose access to Administration.',
        );
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('warns about the loss of access when revoking oneself', () => {
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(ada);

        const dialog = screen.getByRole('alertdialog');

        expect(dialog.textContent).toContain('Revoke your own admin rights?');
        expect(dialog.textContent).toContain(
            'You will lose access to Administration.',
        );
    });

    it('deletes the admin and closes the dialog on success', async () => {
        mocks.delete.mockImplementation(
            (_url: string, options: VisitCallbacks) => {
                options.onSuccess?.();
                options.onFinish?.();
            },
        );
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(grace);
        confirm();

        expect(mocks.delete.mock.calls[0][0]).toBe(`/admin/admins/${grace.id}`);
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('shows the 422 message of the server and stays open', async () => {
        mocks.delete.mockImplementation(
            (_url: string, options: VisitCallbacks) => {
                options.onError?.({
                    user: 'An instance needs at least one admin.',
                });
                options.onFinish?.();
            },
        );
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(grace);
        confirm();

        const alert = await screen.findByRole('alert');

        expect(alert.textContent).toContain(
            'An instance needs at least one admin.',
        );
        expect(screen.getByRole('alertdialog')).toBeTruthy();
        expect(
            screen.getByRole<HTMLButtonElement>('button', { name: 'Revoke' })
                .disabled,
        ).toBe(false);
    });

    it('stays open with a generic message when the request fails without an answer', async () => {
        mocks.delete.mockImplementation(
            (_url: string, options: VisitCallbacks) => {
                options.onFinish?.();
            },
        );
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(grace);
        confirm();

        const alert = await screen.findByRole('alert');

        expect(alert.textContent).toContain(
            'Something went wrong. Please try again.',
        );
        expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('forgets the refusal when the dialog is opened again', async () => {
        mocks.delete.mockImplementation(
            (_url: string, options: VisitCallbacks) => {
                options.onError?.({ user: 'Refused.' });
                options.onFinish?.();
            },
        );
        renderWithProviders(<AdminsPanel admins={[ada, grace]} />);

        askToRevoke(grace);
        confirm();
        await screen.findByRole('alert');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(
            () => expect(screen.queryByRole('alertdialog')).toBeNull(),
            { timeout: 5000 },
        );
        askToRevoke(ada);

        expect(screen.queryByRole('alert')).toBeNull();
    });
});
