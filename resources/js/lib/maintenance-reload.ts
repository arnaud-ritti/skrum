import { router } from '@inertiajs/react';
import { reloadDocument } from '@/lib/reload-document';

type StartedVisit = {
    url: URL;
    method: string;
    prefetch?: boolean;
    async?: boolean;
};

/**
 * The maintenance page is a static document, not an Inertia page: Inertia would
 * show it inside its error modal. A visit answered 503 loads the document
 * instead, at the URL the visit was going to when it was a plain GET, at the
 * current URL otherwise. A prefetch answered 503 is dropped: nobody asked for it.
 */
export function loadDocumentOnMaintenance(): () => void {
    let lastVisit: StartedVisit | null = null;

    const stopStart = router.on('start', (event) => {
        lastVisit = event.detail.visit;
    });

    const stopException = router.on('httpException', (event) => {
        if (event.detail.response.status !== 503) {
            return;
        }

        event.preventDefault();

        const visit = lastVisit;

        if (visit?.prefetch) {
            return;
        }

        if (visit && visit.method === 'get' && !visit.async) {
            reloadDocument(visit.url.href);

            return;
        }

        reloadDocument(null);
    });

    return () => {
        stopStart();
        stopException();
    };
}
