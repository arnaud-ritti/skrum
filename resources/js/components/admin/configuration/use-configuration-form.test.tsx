import { router } from '@inertiajs/react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigurationFields } from '@/lib/admin/types';
import { useConfigurationForm } from './use-configuration-form';

const fields: ConfigurationFields = {
    base_url: {
        value: 'https://login.atlas.test',
        source: 'stored',
        secret: false,
        secretSet: false,
        unreadable: false,
        envName: 'OIDC_BASE_URL',
    },
    client_id: {
        value: 'skrum-prod',
        source: 'environment',
        secret: false,
        secretSet: false,
        unreadable: false,
        envName: 'OIDC_CLIENT_ID',
    },
    client_secret: {
        value: null,
        source: 'stored',
        secret: true,
        secretSet: true,
        unreadable: false,
        envName: 'OIDC_CLIENT_SECRET',
    },
};

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

function setup(onConfirmationRefused = vi.fn()) {
    return renderHook(() =>
        useConfigurationForm(fields, '/admin/sign-in/providers/oidc', {
            onConfirmationRefused,
        }),
    );
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useConfigurationForm', () => {
    it('starts from the non-secret values, empty secrets and nothing to clear', () => {
        const { result } = setup();

        expect(result.current.value('client_id')).toBe('skrum-prod');
        expect(result.current.value('client_secret')).toBe('');
        expect(result.current.isClearing('base_url')).toBe(false);
        expect(result.current.dirtyCount).toBe(0);
    });

    it('counts changed values, typed secrets and clears, and resets them', () => {
        const { result } = setup();

        act(() => result.current.setValue('client_id', 'skrum-next'));
        act(() => result.current.setValue('client_secret', 's3cret'));
        act(() => result.current.setClearing('base_url', true));

        expect(result.current.dirtyCount).toBe(3);

        act(() => result.current.reset());

        expect(result.current.dirtyCount).toBe(0);
        expect(result.current.value('client_id')).toBe('skrum-prod');
        expect(result.current.value('client_secret')).toBe('');
    });

    it('sends only the changed values, the typed secrets and the clears', () => {
        const visit = spyOnVisit();
        const { result } = setup();

        act(() => result.current.setValue('client_id', 'skrum-next'));
        act(() => result.current.setClearing('base_url', true));
        act(() => {
            void result.current.submit();
        });

        expect(visit).toHaveBeenCalledOnce();
        expect(visit.mock.calls[0][0]).toBe('/admin/sign-in/providers/oidc');
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(visit.mock.calls[0][1]?.preserveScroll).toBe(true);
        expect(visit.mock.calls[0][1]?.data).toEqual({
            client_id: 'skrum-next',
            clear: ['base_url'],
        });
    });

    it('does not send a blank secret', () => {
        const visit = spyOnVisit();
        const { result } = setup();

        act(() => result.current.setValue('client_secret', 's3cret'));
        act(() => result.current.setValue('client_secret', '   '));
        act(() => result.current.setValue('client_id', 'skrum-next'));
        act(() => {
            void result.current.submit();
        });

        expect(visit.mock.calls[0][1]?.data).toEqual({
            client_id: 'skrum-next',
        });
    });

    it('does not send a cleared field as a value', () => {
        const visit = spyOnVisit();
        const { result } = setup();

        act(() => result.current.setValue('base_url', 'https://other.test'));
        act(() => result.current.setClearing('base_url', true));
        act(() => {
            void result.current.submit();
        });

        expect(visit.mock.calls[0][1]?.data).toEqual({ clear: ['base_url'] });
    });

    it('keeps the typed values but empties the secrets on a refused confirmation', () => {
        const visit = spyOnVisit();
        const onConfirmationRefused = vi.fn();
        const { result } = setup(onConfirmationRefused);

        act(() => result.current.setValue('client_id', 'skrum-next'));
        act(() => result.current.setValue('client_secret', 's3cret'));
        act(() => {
            void result.current.submit();
        });
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                confirmation: 'Confirm your password again.',
            });
        });

        expect(result.current.value('client_id')).toBe('skrum-next');
        expect(result.current.value('client_secret')).toBe('');
        expect(onConfirmationRefused).toHaveBeenCalledOnce();
    });

    it('empties the secrets and keeps the errors of their fields on any refusal', () => {
        const visit = spyOnVisit();
        const onConfirmationRefused = vi.fn();
        const { result } = setup(onConfirmationRefused);

        act(() => result.current.setValue('base_url', 'http://plain.test'));
        act(() => result.current.setValue('client_secret', 's3cret'));
        act(() => {
            void result.current.submit();
        });
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                base_url: 'The base url must start with https.',
            });
        });

        expect(result.current.value('client_secret')).toBe('');
        expect(result.current.errors.base_url).toBe(
            'The base url must start with https.',
        );
        expect(onConfirmationRefused).not.toHaveBeenCalled();
    });

    it('empties the secrets and counts nothing once a save whose answer is unchanged succeeds', async () => {
        const visit = spyOnVisit();
        const { result } = setup();

        act(() => result.current.setValue('client_secret', 's3cret'));
        act(() => {
            void result.current.submit();
        });
        await act(async () => {
            await Promise.resolve(
                visit.mock.calls[0][1]?.onSuccess?.({} as never),
            );
        });

        expect(result.current.value('client_secret')).toBe('');
        expect(result.current.dirtyCount).toBe(0);

        act(() => result.current.reset());

        expect(result.current.value('client_secret')).toBe('');
    });

    it('does not count a blank value over the environment, and clears a blank stored value', () => {
        const visit = spyOnVisit();
        const { result } = setup();

        act(() => result.current.setValue('client_id', ''));

        expect(result.current.dirtyCount).toBe(0);

        act(() => result.current.setValue('base_url', ''));

        expect(result.current.dirtyCount).toBe(1);

        act(() => {
            void result.current.submit();
        });

        expect(visit.mock.calls[0][1]?.data).toEqual({ clear: ['base_url'] });
    });
});
