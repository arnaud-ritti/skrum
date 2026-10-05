import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { reloadDocument } from '@/lib/reload-document';

type StartedVisit = {
    url: URL;
    method: string;
    prefetch?: boolean;
    async?: boolean;
};

export function header(
    headers: Record<string, unknown>,
    wanted: string,
): unknown {
    const name = Object.keys(headers).find(
        (key) => key.toLowerCase() === wanted,
    );

    return name ? headers[name] : null;
}

export function busyMessage(headers: Record<string, unknown>): string | null {
    const value = header(headers, 'x-database-busy');

    if (typeof value !== 'string' || value === '') {
        return null;
    }

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function withoutFragment(url: URL | Location): string {
    return `${url.origin}${url.pathname}${url.search}`;
}

/**
 * The maintenance page is a static document, not an Inertia page: Inertia would
 * show it inside its error modal. A visit answered 503 loads the document
 * instead, at the URL of the plain GET visit under way, at the current URL
 * otherwise. The answer does not say which visit it belongs to, so every visit
 * under way is kept: a 503 is dropped only when all of them are prefetches,
 * which nobody asked for. A visit to the current URL with another fragment
 * reloads, since assigning it would only move the fragment. A busy database
 * also answers 503, with its message in a header: the instance is up, so the
 * page stays, with what the user typed, and the message is shown as a toast,
 * for a read once `retryOnceWhenDatabaseBusy` was refused again, for a write
 * at once.
 */
export function loadDocumentOnMaintenance(): () => void {
    const visitsUnderWay = new Set<StartedVisit>();

    const stopStart = router.on('start', (event) => {
        visitsUnderWay.add(event.detail.visit);
    });

    const stopFinish = router.on('finish', (event) => {
        visitsUnderWay.delete(event.detail.visit);
    });

    const stopException = router.on('httpException', (event) => {
        if (event.detail.response.status !== 503) {
            return;
        }

        event.preventDefault();

        const busy = busyMessage(event.detail.response.headers);

        if (busy !== null) {
            toast.error(busy);

            return;
        }

        const visits = [...visitsUnderWay];

        if (visits.length > 0 && visits.every((visit) => visit.prefetch)) {
            return;
        }

        const navigation = visits.findLast(
            (visit) =>
                visit.method === 'get' && !visit.async && !visit.prefetch,
        );

        if (
            !navigation ||
            withoutFragment(navigation.url) === withoutFragment(window.location)
        ) {
            reloadDocument(null);

            return;
        }

        reloadDocument(navigation.url.href);
    });

    return () => {
        stopStart();
        stopFinish();
        stopException();
    };
}
