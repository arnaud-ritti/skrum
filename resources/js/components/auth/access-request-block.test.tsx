import { act, fireEvent, screen } from '@testing-library/react';
import { HttpResponseError } from '@inertiajs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessRequestBlock } from '@/components/auth/access-request-block';
import type { AccessRequestOffer } from '@/components/auth/access-request-block';
import { renderWithProviders } from '@/test/render';

type PostOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
};

const server = vi.hoisted(() => ({
    answer: 'created' as
        | 'created'
        | 'invalid'
        | 'alreadyMember'
        | 'throttled'
        | 'failed',
    post: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useState } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({
            props: {
                translations: {},
                auth: { user: { email: 'nadia@nordlys.fr' } },
            },
        }),
        useHttp: (initial: { message: string }) => {
            const [data, setData] = useState(initial);
            const [errors, setErrors] = useState<Record<string, string>>({});

            return {
                data,
                errors,
                processing: false,
                setData: (field: 'message', value: string) =>
                    setData({ ...data, [field]: value }),
                post: async (url: string, options: PostOptions) => {
                    server.post(url, data);

                    if (server.answer === 'failed') {
                        throw new Error('Request failed with status 429');
                    }

                    if (server.answer === 'throttled') {
                        throw new HttpResponseError(
                            'Request failed with status 429',
                            { status: 429, data: '', headers: {} },
                            url,
                        );
                    }

                    if (server.answer === 'alreadyMember') {
                        const refused = {
                            team: 'You are already in this team.',
                        };

                        setErrors(refused);
                        options.onError?.(refused);

                        return undefined;
                    }

                    if (server.answer === 'invalid') {
                        const refused = {
                            message:
                                'The message field must not be greater than 500 characters.',
                        };

                        setErrors(refused);
                        options.onError?.(refused);

                        return undefined;
                    }

                    setErrors({});
                    options.onSuccess?.();

                    return { status: 'pending' };
                },
            };
        },
    };
});

function offer(
    overrides: Partial<AccessRequestOffer> = {},
): AccessRequestOffer {
    return {
        team: { id: 'team-1', name: 'Atlas' },
        workspace: { name: 'Nordlys' },
        memberCount: 11,
        managers: [
            { name: 'Camille Roux', avatarUrl: '' },
            { name: 'Théo Martin', avatarUrl: '' },
        ],
        managersMore: 0,
        pending: false,
        storeUrl: '/w/nordlys/teams/team-1/access-requests',
        ...overrides,
    };
}

async function requestAccess(): Promise<void> {
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
        await Promise.resolve();
    });
}

describe('AccessRequestBlock', () => {
    beforeEach(() => {
        server.answer = 'created';
        server.post.mockReset();
        toast.success.mockReset();
    });

    it('names the team, its workspace, the account and the team admins', () => {
        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        expect(screen.getByText('Atlas')).toBeTruthy();
        expect(screen.getByText('Nordlys workspace · 11 members')).toBeTruthy();
        expect(screen.getByText('nadia@nordlys.fr').tagName).toBe('B');
        expect(
            screen.getByText('Team admins: Camille Roux, Théo Martin'),
        ).toBeTruthy();
        expect(
            screen.getByRole('textbox', {
                name: 'Message to the admins (optional)',
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Switch account' }),
        ).toBeTruthy();
    });

    it('counts a single member in the singular and the admins it does not name', () => {
        renderWithProviders(
            <AccessRequestBlock
                offer={offer({
                    memberCount: 1,
                    managers: [
                        { name: 'Camille Roux', avatarUrl: '' },
                        { name: 'Inès Petit', avatarUrl: '' },
                        { name: 'Théo Martin', avatarUrl: '' },
                    ],
                    managersMore: 2,
                })}
            />,
        );

        expect(screen.getByText('Nordlys workspace · 1 member')).toBeTruthy();
        expect(
            screen.getByText(
                'Team admins: Camille Roux, Inès Petit, Théo Martin and 2 others',
            ),
        ).toBeTruthy();
    });

    it('opens in the sent state when a request is pending', () => {
        renderWithProviders(
            <AccessRequestBlock offer={offer({ pending: true })} />,
        );

        const sent = screen.getByRole('button', { name: 'Request sent' });

        expect(sent.getAttribute('aria-disabled')).toBe('true');
        expect(document.activeElement).not.toBe(sent);
        expect(
            screen.queryByRole('button', { name: 'Request access' }),
        ).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('sends the message, then shows the request as sent', async () => {
        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        fireEvent.change(
            screen.getByRole('textbox', {
                name: 'Message to the admins (optional)',
            }),
            { target: { value: "I'm covering for Théo on sprint 43." } },
        );
        await requestAccess();

        expect(server.post).toHaveBeenCalledWith(
            '/w/nordlys/teams/team-1/access-requests',
            { message: "I'm covering for Théo on sprint 43." },
        );
        expect(toast.success).toHaveBeenCalledWith(
            "Request sent. You'll see the answer in your notifications.",
        );
        const sent = screen.getByRole('button', { name: 'Request sent' });

        expect(sent.getAttribute('aria-disabled')).toBe('true');
        expect(document.activeElement).toBe(sent);
        expect(screen.getByRole('status').textContent).toBe(
            "Request sent. You'll see the answer in your notifications.",
        );
    });

    it('keeps the form with the error under the field when the message is refused', async () => {
        server.answer = 'invalid';

        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        await requestAccess();

        const field = screen.getByRole('textbox', {
            name: 'Message to the admins (optional)',
        });

        expect(
            screen.getByText(
                'The message field must not be greater than 500 characters.',
            ),
        ).toBeTruthy();
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(
            screen.getByRole('button', { name: 'Request access' }),
        ).toBeTruthy();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('keeps the form and says so when the request fails', async () => {
        server.answer = 'failed';

        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        await requestAccess();

        expect(
            screen.getByText('Something went wrong. Please try again.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Request access' }),
        ).toBeTruthy();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('shows a refusal about the team itself', async () => {
        server.answer = 'alreadyMember';

        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        await requestAccess();

        expect(screen.getByText('You are already in this team.')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Request access' }),
        ).toBeTruthy();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('asks to wait rather than retry when too many requests were sent', async () => {
        server.answer = 'throttled';

        renderWithProviders(<AccessRequestBlock offer={offer()} />);

        await requestAccess();

        expect(
            screen.getByText('Too many access requests. Try again later.'),
        ).toBeTruthy();
        expect(
            screen.queryByText('Something went wrong. Please try again.'),
        ).toBeNull();
    });

    it('keeps one avatar for each of two admins with the same name', () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

        renderWithProviders(
            <AccessRequestBlock
                offer={offer({
                    managers: [
                        { name: 'Camille Roux', avatarUrl: '' },
                        { name: 'Camille Roux', avatarUrl: '' },
                    ],
                })}
            />,
        );

        expect(
            errors.mock.calls.some((call) =>
                String(call[0]).includes('same key'),
            ),
        ).toBe(false);
        errors.mockRestore();
    });
});
