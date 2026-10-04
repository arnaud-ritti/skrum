import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteStep } from '@/components/onboarding/invite-step';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    only?: string[];
    onSuccess?: (page: { flash: Record<string, unknown> }) => void;
    onError?: (errors: Record<string, string>) => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post, put: mocks.put, delete: mocks.delete },
}));

vi.mock('sonner', () => ({
    toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.put.mockReset();
    mocks.delete.mockReset();
    mocks.toastSuccess.mockReset();
});

const team = { id: 't1', name: 'Atlas', color: 'lagoon' as const };

const link = {
    url: 'https://skrum.test/invite/abc',
    expiresInDays: 7,
    usesCount: 3,
};

function renderStep(withLink: typeof link | null = link) {
    return renderWithProviders(
        <InviteStep
            workspaceSlug="nordlys"
            team={team}
            roles={['facilitator', 'member', 'observer']}
            link={withLink}
        />,
    );
}

describe('InviteStep', () => {
    it('shows the form with the team link, its expiry and who joined', () => {
        renderStep();

        expect(screen.getByText('Step 3 of 4')).toBeTruthy();
        expect(
            screen.getByRole('heading', { name: 'Invite your teammates' }),
        ).toBeTruthy();
        expect(screen.getByText('https://skrum.test/invite/abc')).toBeTruthy();
        expect(screen.getByText(/Expires in 7 days/)).toBeTruthy();
        expect(screen.getByText(/3 joined/)).toBeTruthy();
        expect(screen.getByText('They join Atlas as members.')).toBeTruthy();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('creates the team link once when the step shows without one', () => {
        const { rerender } = renderStep(null);

        rerender(
            <InviteStep
                workspaceSlug="nordlys"
                team={team}
                roles={['member']}
                link={null}
            />,
        );

        expect(mocks.post).toHaveBeenCalledOnce();
        expect(mocks.post.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/invite-link',
        );
        expect((mocks.post.mock.calls[0][2] as VisitOptions).only).toContain(
            'inviteLinkUrl',
        );
    });

    it('moves to the first ritual with "Skip"', () => {
        renderStep();

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(mocks.put.mock.calls[0][0]).toBe('/onboarding/step');
        expect(mocks.put.mock.calls[0][1]).toEqual({ step: 'ritual' });
    });

    it('sends the invitations through the onboarding and shows an address error', () => {
        mocks.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({
                    'emails.1': 'theo@nordlys.io is already in Atlas.',
                }),
        );
        renderStep();

        const input = screen.getByLabelText('Emails');

        fireEvent.change(input, {
            target: { value: 'camille@nordlys.io theo@nordlys.io' },
        });
        fireEvent.keyDown(input, { key: 'Enter' });
        fireEvent.click(
            screen.getByRole('button', { name: 'Send 2 invitations' }),
        );

        expect(mocks.post.mock.calls[0][0]).toBe('/onboarding/invitations');
        expect(mocks.post.mock.calls[0][1]).toEqual({
            emails: ['camille@nordlys.io', 'theo@nordlys.io'],
            role: 'member',
            message: '',
        });
        expect(
            screen.getByText('theo@nordlys.io is already in Atlas.'),
        ).toBeTruthy();
    });
});
