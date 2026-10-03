import { router } from '@inertiajs/react';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailLastTest } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { MailTestForm } from './mail-test-form';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function setup(lastTest: MailLastTest | null = null, dirty = false): void {
    renderWithProviders(
        <MailTestForm
            defaultRecipient="arnaud@atlas.test"
            lastTest={lastTest}
            dirty={dirty}
        />,
    );
}

function recipient(): HTMLInputElement {
    return screen.getByLabelText('Send a test e-mail') as HTMLInputElement;
}

function send(): HTMLButtonElement {
    return screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T14:30:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MailTestForm', () => {
    it('shows no result line before the first test', () => {
        setup();

        expect(screen.queryByText(/Last test/)).toBeNull();
        expect(recipient().value).toBe('arnaud@atlas.test');
    });

    it('says when the last test was delivered', () => {
        setup({
            at: '2026-10-15T14:02:00Z',
            ok: true,
            to: 'arnaud@atlas.test',
            error: null,
        });

        expect(screen.getByText('Last test delivered today')).not.toBeNull();
    });

    it('says why the last test failed, in a sentence', () => {
        setup({
            at: '2026-10-14T09:00:00Z',
            ok: false,
            to: 'arnaud@atlas.test',
            error: 'transport',
        });

        expect(
            screen.getByText(
                'Last test failed yesterday: the mail server could not be reached or refused the message.',
            ),
        ).not.toBeNull();
    });

    it('posts the address to send the test to', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.change(recipient(), {
            target: { value: 'camille@atlas.test' },
        });
        fireEvent.click(send());

        expect(visit.mock.calls[0][0]).toBe('/admin/mail/tests');
        expect(visit.mock.calls[0][1]?.method).toBe('post');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            to: 'camille@atlas.test',
        });
    });

    it('asks to wait when the server refuses one more test', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.click(send());

        let handled: boolean | void = undefined;

        act(() => {
            handled = visit.mock.calls[0][1]?.onHttpException?.({
                status: 429,
                headers: {},
                data: '',
            });
        });

        expect(handled).toBe(false);
        expect(
            screen.getByText('Wait a few minutes before the next test.'),
        ).not.toBeNull();
    });

    it('cannot send while the settings have unsaved changes', () => {
        setup(null, true);

        expect(send().disabled).toBe(true);
        expect(
            screen.getByText('Save first to test these values.'),
        ).not.toBeNull();
    });
});
