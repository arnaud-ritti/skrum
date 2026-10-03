import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordGateContext } from '@/components/settings/password-gate';
import { renderWithProviders } from '@/test/render';
import { ActiveSessionsCard } from './active-sessions-card';
import type { BrowserSessionRow } from './active-sessions-card';

type VisitOptions = {
    preserveScroll?: boolean;
    onSuccess?: () => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn(), reload: vi.fn() }));
const mobile = vi.hoisted(() => ({ value: false }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => mobile.value,
}));

const now = Date.now();

const current: BrowserSessionRow = {
    key: 'a'.repeat(64),
    device: 'Firefox on macOS',
    deviceKind: 'desktop',
    ipAddress: '203.0.113.7',
    isCurrent: true,
    lastActiveAt: new Date(now - 30_000).toISOString(),
};

const phone: BrowserSessionRow = {
    key: 'b'.repeat(64),
    device: 'Safari on iOS',
    deviceKind: 'phone',
    ipAddress: '2001:db8:85a3:0000:0000:8a2e:0370:7334',
    isCurrent: false,
    lastActiveAt: new Date(now - 2 * 3_600_000).toISOString(),
};

const unknown: BrowserSessionRow = {
    key: 'c'.repeat(64),
    device: 'Unknown device',
    deviceKind: 'unknown',
    ipAddress: null,
    isCurrent: false,
    lastActiveAt: new Date(now - 3 * 86_400_000).toISOString(),
};

const guard = vi.fn((action: () => void) => action());

function withGate(ui: ReactElement) {
    return renderWithProviders(
        <PasswordGateContext.Provider value={{ guard }}>
            {ui}
        </PasswordGateContext.Provider>,
    );
}

function row(session: BrowserSessionRow): HTMLElement {
    return document.querySelector(
        `[data-session-key="${session.key}"]`,
    ) as HTMLElement;
}

beforeEach(() => {
    router.delete.mockReset();
    router.delete.mockImplementation((_url: string, options: VisitOptions) =>
        options.onSuccess?.(),
    );
    guard.mockClear();
    mobile.value = false;
});

describe('ActiveSessionsCard', () => {
    it('is the card "Active sessions" with the sentence of the owner, and no location', () => {
        withGate(<ActiveSessionsCard sessions={[current, phone]} />);

        const card = screen.getByRole('region', { name: 'Active sessions' });

        expect(card.closest('[data-slot="active-sessions"]')).not.toBeNull();
        expect(card.textContent).toContain(
            'Devices signed in to your account.',
        );
        expect(card.textContent).not.toContain('Location');
        expect(
            within(card)
                .getAllByRole('columnheader')
                .map((header) => header.textContent),
        ).toEqual(['Device', 'IP address', 'Last active', 'Sign out']);
    });

    it('draws a laptop, a smartphone or a crossed-out monitor by the kind of device', () => {
        withGate(<ActiveSessionsCard sessions={[current, phone, unknown]} />);

        expect(row(current).querySelector('.lucide-laptop')).not.toBeNull();
        expect(row(phone).querySelector('.lucide-smartphone')).not.toBeNull();
        expect(
            row(unknown).querySelector('.lucide-monitor-off'),
        ).not.toBeNull();
    });

    it('shows the full IPv4 or IPv6 address in mono, breaking anywhere, and "Unknown" without one', () => {
        withGate(<ActiveSessionsCard sessions={[current, phone, unknown]} />);

        const v4 = within(row(current)).getByText('203.0.113.7');
        const v6 = within(row(phone)).getByText(phone.ipAddress as string);

        expect(v4.className).toContain('font-mono');
        expect(v6.className).toContain('font-mono');
        expect(v6.className).toContain('break-all');
        expect(within(row(unknown)).getByText('Unknown').className).toContain(
            'text-muted-foreground',
        );
    });

    it('marks this device, active now, with no button to sign it out', () => {
        withGate(<ActiveSessionsCard sessions={[current, phone]} />);

        expect(within(row(current)).getByText('This device')).toBeTruthy();
        expect(within(row(current)).getByText('Active now')).toBeTruthy();
        expect(
            within(row(current)).queryByRole('button', { name: /Sign out/ }),
        ).toBeNull();
        expect(within(row(phone)).queryByText('This device')).toBeNull();
        expect(within(row(phone)).getByText('2 hours ago')).toBeTruthy();
    });

    it('signs one device out after its own confirmation, through the gate', async () => {
        withGate(<ActiveSessionsCard sessions={[current, phone]} />);

        await userEvent.click(
            within(row(phone)).getByRole('button', { name: 'Sign out' }),
        );

        expect(guard).toHaveBeenCalledOnce();

        const dialog = screen.getByRole('alertdialog', {
            name: 'Sign out this device?',
        });

        expect(dialog.textContent).toContain('Safari on iOS');
        expect(router.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Sign out' }),
        );

        expect(router.delete.mock.calls[0][0]).toBe(
            `/settings/sessions/${phone.key}`,
        );
        expect(router.delete.mock.calls[0][1]).toMatchObject({
            preserveScroll: true,
        });
        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
    });

    it('signs every other device out after the confirmation, through the gate', async () => {
        withGate(<ActiveSessionsCard sessions={[current, phone, unknown]} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Sign out other sessions' }),
        );

        expect(guard).toHaveBeenCalledOnce();

        const dialog = screen.getByRole('alertdialog', {
            name: 'Sign out every other device?',
        });

        expect(dialog.textContent).toContain(
            'They will need to sign in again. "Remember me" ends on every device.',
        );

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Sign out' }),
        );

        expect(router.delete.mock.calls[0][0]).toBe('/settings/sessions');
        expect(router.delete.mock.calls[0][1]).toMatchObject({
            preserveScroll: true,
        });
    });

    it('disables "Sign out other sessions" when this device is the only one', () => {
        withGate(<ActiveSessionsCard sessions={[current]} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Sign out other sessions',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('is concealed before the confirmation: nothing of the account, one action through the gate', async () => {
        withGate(<ActiveSessionsCard sessions={null} />);

        const card = screen.getByRole('region', { name: 'Active sessions' });

        expect(card.querySelector('[data-session-key]')).toBeNull();
        expect(card.textContent).toContain(
            'Confirm your password to see your devices.',
        );
        expect(
            (
                screen.getByRole('button', {
                    name: 'Sign out other sessions',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        await userEvent.click(
            screen.getByRole('button', { name: 'Show my devices' }),
        );

        expect(guard).toHaveBeenCalledOnce();
        expect(router.delete).not.toHaveBeenCalled();
    });

    it('lists one card per device on a phone, the address under the label', async () => {
        mobile.value = true;
        withGate(<ActiveSessionsCard sessions={[current, phone, unknown]} />);

        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.getAllByRole('listitem')).toHaveLength(3);

        const label = within(row(phone)).getByText('Safari on iOS');
        const address = within(row(phone)).getByText(phone.ipAddress as string);

        expect(
            label.compareDocumentPosition(address) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(within(row(current)).getByText('This device')).toBeTruthy();
        expect(within(row(unknown)).getByText('Unknown')).toBeTruthy();

        await userEvent.click(
            within(row(phone)).getByRole('button', { name: 'Sign out' }),
        );

        expect(
            screen.getByRole('alertdialog', { name: 'Sign out this device?' }),
        ).toBeTruthy();
    });
});
