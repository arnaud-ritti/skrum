import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerOffset } from '@/hooks/use-countdown';

const start = new Date('2026-10-21T10:00:00Z');

let rerender: () => void = () => {};

function Probe({ serverTime, seen }: { serverTime: string; seen: number[] }) {
    const offset = useServerOffset(serverTime);
    const [, setRenders] = useState(0);

    rerender = () => setRenders((count) => count + 1);
    seen.push(offset);

    return null;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useServerOffset', () => {
    it('keeps the offset taken when the server time arrived, render after render', () => {
        const seen: number[] = [];

        render(
            <Probe
                serverTime={new Date(start.getTime() + 5_000).toISOString()}
                seen={seen}
            />,
        );

        vi.advanceTimersByTime(2_000);
        act(() => rerender());

        expect(seen).toEqual([5_000, 5_000]);
    });

    it('takes a new offset for a new server time', () => {
        const seen: number[] = [];
        const { rerender: rerenderWith } = render(
            <Probe serverTime={start.toISOString()} seen={seen} />,
        );

        vi.advanceTimersByTime(2_000);
        rerenderWith(
            <Probe
                serverTime={new Date(start.getTime() + 3_000).toISOString()}
                seen={seen}
            />,
        );

        expect(seen.at(-1)).toBe(1_000);
    });
});
