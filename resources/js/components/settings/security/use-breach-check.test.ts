import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBreachCheck } from './use-breach-check';

type Answer = { suffixes: string[] };
type Sent = { url: string; method: string; body: unknown };

const PasswordHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';
const PasswordSuffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

const hashing = vi.hoisted(() => ({
    sha1Hex: vi.fn<(text: string) => Promise<string | null>>(),
}));
const server = vi.hoisted(() => {
    const transform = { current: (data: unknown) => data };

    return {
        transformRef: transform,
        sent: [] as Sent[],
        answer: vi.fn<() => Promise<Answer | undefined>>(),
        transform: vi.fn((callback: (data: unknown) => unknown) => {
            transform.current = callback;
        }),
        cancel: vi.fn(),
    };
});

vi.mock('@/lib/settings/breach-check', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/settings/breach-check')>()),
    sha1Hex: hashing.sha1Hex,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const submit = async (route: { url: string; method: string }) => {
        server.sent.push({
            url: route.url,
            method: route.method,
            body: server.transformRef.current({}),
        });

        return server.answer();
    };

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        useHttp: () => ({
            transform: server.transform,
            submit,
            cancel: server.cancel,
        }),
    };
});

function failure(status: number): Error {
    return Object.assign(new Error(`Request failed with status ${status}`), {
        response: { status },
    });
}

async function settle(milliseconds = 600): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds);
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    server.sent = [];
    server.answer.mockReset();
    server.cancel.mockReset();
    hashing.sha1Hex.mockReset();
    hashing.sha1Hex.mockResolvedValue(PasswordHash);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useBreachCheck', () => {
    it('stays idle with nothing typed or with the check off, and asks nothing', async () => {
        const empty = renderHook(() => useBreachCheck('', true));
        const off = renderHook(() => useBreachCheck('password', false));

        await settle();

        expect(empty.result.current).toBe('idle');
        expect(off.result.current).toBe('idle');
        expect(server.sent).toEqual([]);
    });

    it('is checking while the request runs, then clear when the range lacks the suffix', async () => {
        let answer: (value: Answer) => void = () => undefined;

        server.answer.mockReturnValue(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        const { result } = renderHook(() => useBreachCheck('password', true));

        await settle();

        expect(result.current).toBe('checking');

        await act(async () => {
            answer({ suffixes: ['0018A45C4D1DEF81644B54AB7F969B88D65'] });
        });

        expect(result.current).toBe('clear');
    });

    it('is breached when the range holds the suffix', async () => {
        server.answer.mockResolvedValue({ suffixes: [PasswordSuffix] });
        const { result } = renderHook(() => useBreachCheck('password', true));

        await settle();

        expect(result.current).toBe('breached');
    });

    it('is unavailable, not clear, when the answer holds no range', async () => {
        server.answer.mockResolvedValue(undefined);
        const { result } = renderHook(() => useBreachCheck('password', true));

        await settle();

        expect(result.current).toBe('unavailable');
    });

    it('waits 600 ms after the last keystroke and sends exactly five characters of the hash', async () => {
        server.answer.mockResolvedValue({ suffixes: [] });
        renderHook(() => useBreachCheck('password', true));

        await settle(599);

        expect(server.sent).toEqual([]);

        await settle(1);

        expect(server.sent).toEqual([
            {
                url: '/settings/password/breach-range',
                method: 'post',
                body: { prefix: '5BAA6' },
            },
        ]);
    });

    it.each([
        ['a 404, the check being off', () => Promise.reject(failure(404))],
        [
            'a 503, the range being out of reach',
            () => Promise.reject(failure(503)),
        ],
        ['a network error', () => Promise.reject(new TypeError('offline'))],
    ])('is unavailable on %s', async (_, answer) => {
        server.answer.mockImplementation(answer);
        const { result } = renderHook(() => useBreachCheck('password', true));

        await settle();

        expect(result.current).toBe('unavailable');
    });

    it('is unavailable and asks nothing without crypto.subtle', async () => {
        hashing.sha1Hex.mockResolvedValue(null);
        const { result } = renderHook(() => useBreachCheck('password', true));

        await settle();

        expect(result.current).toBe('unavailable');
        expect(server.sent).toEqual([]);
    });

    it('cancels the older request for a newer password: the last answer wins', async () => {
        let answerOlder: (value: Answer) => void = () => undefined;

        server.answer
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    answerOlder = resolve;
                }),
            )
            .mockResolvedValueOnce({ suffixes: [PasswordSuffix] });
        const { result, rerender } = renderHook(
            ({ password }) => useBreachCheck(password, true),
            { initialProps: { password: 'passwor' } },
        );

        await settle();
        rerender({ password: 'password' });

        expect(server.cancel).toHaveBeenCalled();

        await settle();

        expect(result.current).toBe('breached');

        await act(async () => {
            answerOlder({ suffixes: [] });
        });

        expect(result.current).toBe('breached');
        expect(server.sent).toHaveLength(2);
    });
});
