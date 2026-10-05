import { HttpCancelledError, HttpResponseError } from '@inertiajs/core';
import type { HttpResponse } from '@inertiajs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { retryOnceWhenDatabaseBusy } from '@/lib/busy-database-retry';

const busy: HttpResponse = {
    status: 503,
    data: '',
    headers: { 'retry-after': '2', 'x-database-busy': 'Busy' },
};

const ok: HttpResponse = { status: 200, data: '{}', headers: {} };

function refusal(response: HttpResponse): HttpResponseError {
    return new HttpResponseError('Request failed', response, '/decks');
}

function answering(...answers: HttpResponse[]) {
    const request = vi.fn();

    for (const answer of answers) {
        request.mockImplementationOnce(() =>
            answer.status >= 400
                ? Promise.reject(refusal(answer))
                : Promise.resolve(answer),
        );
    }

    return request;
}

describe('retryOnceWhenDatabaseBusy', () => {
    beforeEach(() => vi.useFakeTimers());

    afterEach(() => vi.useRealTimers());

    it('sends the request again once the Retry-After of a busy database has passed', async () => {
        const request = answering(busy, ok);
        const sent = retryOnceWhenDatabaseBusy({ request }).request({
            method: 'post',
            url: '/decks',
        });

        await vi.advanceTimersByTimeAsync(1999);
        expect(request).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        await expect(sent).resolves.toBe(ok);
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('gives the second busy answer back so that its message is shown', async () => {
        const request = answering(busy, busy);
        const sent = retryOnceWhenDatabaseBusy({ request }).request({
            method: 'post',
            url: '/decks',
        });
        const outcome = expect(sent).rejects.toMatchObject({
            response: { status: 503 },
        });

        await vi.advanceTimersByTimeAsync(2000);
        await outcome;
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('waits one second when the busy answer has no usable Retry-After', async () => {
        const request = answering(
            { ...busy, headers: { 'X-Database-Busy': 'Busy' } },
            ok,
        );
        const sent = retryOnceWhenDatabaseBusy({ request }).request({
            method: 'post',
            url: '/decks',
        });

        await vi.advanceTimersByTimeAsync(1000);
        await expect(sent).resolves.toBe(ok);
    });

    it('does not retry a 503 of maintenance mode nor any other refusal', async () => {
        for (const answer of [
            { ...busy, headers: { 'retry-after': '2' } },
            { ...busy, status: 500 },
        ]) {
            const request = answering(answer, ok);

            await expect(
                retryOnceWhenDatabaseBusy({ request }).request({
                    method: 'get',
                    url: '/decks',
                }),
            ).rejects.toBeInstanceOf(HttpResponseError);
            expect(request).toHaveBeenCalledTimes(1);
        }
    });

    it('drops the retry of a request cancelled while it waits', async () => {
        const request = answering(busy, ok);
        const controller = new AbortController();
        const sent = retryOnceWhenDatabaseBusy({ request }).request({
            method: 'post',
            url: '/decks',
            signal: controller.signal,
        });
        const outcome = expect(sent).rejects.toBeInstanceOf(HttpCancelledError);

        await vi.advanceTimersByTimeAsync(500);
        controller.abort();
        await vi.advanceTimersByTimeAsync(2000);

        await outcome;
        expect(request).toHaveBeenCalledTimes(1);
    });
});
