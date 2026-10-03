import { router } from '@inertiajs/react';

/** Rendered on `<html>` for a member who turned "Reduce animations" on. */
export const ReduceMotionClass = 'reduce-motion';

export const MotionChangedEvent = 'skrum:motion';

const ReducedMotionQuery = '(prefers-reduced-motion: reduce)';

function systemQuery(): MediaQueryList | null {
    if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
    ) {
        return null;
    }

    return window.matchMedia(ReducedMotionQuery);
}

/** The member's preference, or the system's when the member has not asked. */
export function prefersReducedMotion(): boolean {
    if (
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains(ReduceMotionClass)
    ) {
        return true;
    }

    return systemQuery()?.matches === true;
}

/** Whether the system alone asks for fewer animations. */
export function systemPrefersReducedMotion(): boolean {
    return systemQuery()?.matches === true;
}

export function applyReduceMotion(on: boolean): void {
    document.documentElement.classList.toggle(ReduceMotionClass, on);
    window.dispatchEvent(new Event(MotionChangedEvent));
}

/**
 * Keeps the class in step with the account of each page, so a sign-out by
 * an Inertia visit takes it off without a full reload.
 */
export function followAccountMotion(): () => void {
    return router.on('navigate', (event) => {
        const auth = event.detail.page.props.auth as
            | { user?: { reduce_motion?: unknown } | null }
            | undefined;
        const on = auth?.user?.reduce_motion === true;

        if (
            document.documentElement.classList.contains(ReduceMotionClass) !==
            on
        ) {
            applyReduceMotion(on);
        }
    });
}

export function subscribeToMotion(onChange: () => void): () => void {
    const query = systemQuery();

    query?.addEventListener('change', onChange);
    window.addEventListener(MotionChangedEvent, onChange);

    return () => {
        query?.removeEventListener('change', onChange);
        window.removeEventListener(MotionChangedEvent, onChange);
    };
}
