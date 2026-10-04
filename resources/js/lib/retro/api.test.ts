import { http } from '@inertiajs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retroRequest, RetroRequestError } from '@/lib/retro/api';

afterEach(() => {
    vi.restoreAllMocks();
});

function answerWith(status: number, data: string): void {
    vi.spyOn(http, 'getClient').mockReturnValue({
        request: vi.fn().mockResolvedValue({ status, data, headers: {} }),
    } as unknown as ReturnType<typeof http.getClient>);
}

describe('retroRequest', () => {
    it('reads the JSON of a success', async () => {
        answerWith(200, '{"ok":true}');

        await expect(
            retroRequest({ url: '/x', method: 'get' }),
        ).resolves.toEqual({ ok: true });
    });

    it('fails as a request error when a success is not JSON', async () => {
        answerWith(200, '<!doctype html><title>Log in</title>');

        const failure = retroRequest({ url: '/x', method: 'get' });

        await expect(failure).rejects.toBeInstanceOf(RetroRequestError);
        await expect(failure).rejects.toMatchObject({ status: 200 });
    });
});
