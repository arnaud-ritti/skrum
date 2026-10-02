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
