import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDocumentOnMaintenance } from '@/lib/maintenance-reload';

const reload = vi.hoisted(() => vi.fn());

vi.mock('@/lib/reload-document', () => ({ reloadDocument: reload }));

type StartedVisit = {
    url: URL;
    method: string;
    prefetch?: boolean;
    async?: boolean;
};

function start(visit: StartedVisit): void {
    document.dispatchEvent(
        new CustomEvent('inertia:start', { detail: { visit } }),
    );
}

function finish(visit: StartedVisit): void {
    document.dispatchEvent(
        new CustomEvent('inertia:finish', { detail: { visit } }),
    );
}

function answer(status: number): boolean {
    return document.dispatchEvent(
        new CustomEvent('inertia:httpException', {
            cancelable: true,
            detail: {
                response: { status, data: '<html></html>', headers: {} },
            },
        }),
    );
}

describe('loadDocumentOnMaintenance', () => {
    let stop: () => void;

    beforeEach(() => {
        reload.mockClear();
        stop = loadDocumentOnMaintenance();
    });

    afterEach(() => stop());

    it('loads the document of the visited URL when a GET visit is answered 503, and keeps Inertia from showing its modal', () => {
        start({ url: new URL('http://localhost/teams/demo'), method: 'get' });

        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(
            'http://localhost/teams/demo',
        );
    });

    it('reloads the current document when the visit answered 503 was not a GET', () => {
        start({ url: new URL('http://localhost/logout'), method: 'post' });

        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('reloads the current document when a background request is answered 503', () => {
        start({
            url: new URL('http://localhost/teams/demo/poll'),
            method: 'get',
            async: true,
        });

        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('leaves the page alone when a prefetch is answered 503', () => {
        start({
            url: new URL('http://localhost/teams/demo'),
            method: 'get',
            prefetch: true,
        });

        expect(answer(503)).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it('loads the document of the clicked link when a prefetch started after it', () => {
        start({ url: new URL('http://localhost/teams/demo'), method: 'get' });
        start({
            url: new URL('http://localhost/settings'),
            method: 'get',
            prefetch: true,
        });

        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(
            'http://localhost/teams/demo',
        );
    });

    it('forgets a visit once it has finished', () => {
        const visit = {
            url: new URL('http://localhost/teams/demo'),
            method: 'get',
        };

        start(visit);
        finish(visit);
        start({
            url: new URL('http://localhost/settings'),
            method: 'get',
            prefetch: true,
        });

        expect(answer(503)).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it('reloads the current document when the visit only differs from it by its fragment', () => {
        window.history.replaceState(null, '', '/teams/demo#members');
        start({
            url: new URL(`${window.location.origin}/teams/demo#sessions`),
            method: 'get',
        });

        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(null);

        window.history.replaceState(null, '', '/');
    });

    it('reloads the current document when no visit is known', () => {
        expect(answer(503)).toBe(false);
        expect(reload).toHaveBeenCalledExactlyOnceWith(null);
    });

    it('leaves every other status to Inertia', () => {
        start({ url: new URL('http://localhost/teams/demo'), method: 'get' });

        expect(answer(500)).toBe(true);
        expect(answer(404)).toBe(true);
        expect(reload).not.toHaveBeenCalled();
    });

    it('stops listening once stopped', () => {
        stop();

        expect(answer(503)).toBe(true);
        expect(reload).not.toHaveBeenCalled();
    });
});
