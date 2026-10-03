import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyReduceMotion,
    MotionChangedEvent,
    prefersReducedMotion,
    ReduceMotionClass,
    subscribeToMotion,
} from '@/lib/motion';

const original = window.matchMedia;

type Listener = () => void;

function systemAsks(matches: boolean): { listeners: Set<Listener> } {
    const listeners = new Set<Listener>();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: (_: string, listener: Listener) =>
            listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) =>
            listeners.delete(listener),
    }));

    return { listeners };
}

afterEach(() => {
    window.matchMedia = original;
    document.documentElement.classList.remove(ReduceMotionClass);
});

describe('prefersReducedMotion', () => {
    it('is true with the class on the root element, whatever the system says', () => {
        systemAsks(false);
        document.documentElement.classList.add(ReduceMotionClass);

        expect(prefersReducedMotion()).toBe(true);
    });

    it('follows the system without the class', () => {
        systemAsks(true);

        expect(prefersReducedMotion()).toBe(true);

        systemAsks(false);

        expect(prefersReducedMotion()).toBe(false);
    });

    it('is false where there is no media query', () => {
        window.matchMedia = undefined as unknown as typeof window.matchMedia;

        expect(prefersReducedMotion()).toBe(false);
    });
});

describe('applyReduceMotion', () => {
    it('adds and removes the class and notifies a subscriber', () => {
        systemAsks(false);
        const onChange = vi.fn();
        const unsubscribe = subscribeToMotion(onChange);

        applyReduceMotion(true);

        expect(
            document.documentElement.classList.contains(ReduceMotionClass),
        ).toBe(true);
        expect(onChange).toHaveBeenCalledTimes(1);

        applyReduceMotion(false);

        expect(
            document.documentElement.classList.contains(ReduceMotionClass),
        ).toBe(false);
        expect(onChange).toHaveBeenCalledTimes(2);

        unsubscribe();
    });

    it('dispatches the motion event on window', () => {
        const onEvent = vi.fn();
        window.addEventListener(MotionChangedEvent, onEvent);

        applyReduceMotion(true);

        expect(onEvent).toHaveBeenCalledTimes(1);

        window.removeEventListener(MotionChangedEvent, onEvent);
    });
});

describe('subscribeToMotion', () => {
    it('listens to the system query and stops once unsubscribed', () => {
        const { listeners } = systemAsks(false);
        const onChange = vi.fn();
        const unsubscribe = subscribeToMotion(onChange);

        listeners.forEach((listener) => listener());

        expect(onChange).toHaveBeenCalledTimes(1);

        unsubscribe();
        applyReduceMotion(true);

        expect(listeners.size).toBe(0);
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
