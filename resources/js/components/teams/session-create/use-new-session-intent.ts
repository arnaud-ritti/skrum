import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export type SessionType = 'retro' | 'poker' | 'whiteboard' | 'icebreaker';

export type NewSessionIntent = {
    type: SessionType;
    template?: string;
    deck?: string;
    /** Set on an intent read after the page mounted: a new number asks for the dialog again. */
    request?: number;
};

const IntentTypes: readonly SessionType[] = ['retro', 'poker', 'whiteboard'];

const IntentParameters = ['new', 'template', 'deck'] as const;

export function readNewSessionIntent(search: string): NewSessionIntent | null {
    const query = new URLSearchParams(search);
    const type = query.get('new');

    if (type === null || !IntentTypes.includes(type as SessionType)) {
        return null;
    }

    const template = query.get('template');
    const deck = query.get('deck');

    return {
        type: type as SessionType,
        ...(template === null || template === '' ? {} : { template }),
        ...(deck === null || deck === '' ? {} : { deck }),
    };
}

export function withoutNewSessionIntent(href: string): string {
    const url = new URL(href);

    for (const parameter of IntentParameters) {
        url.searchParams.delete(parameter);
    }

    return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Read from the URL when the page mounts, and again on each navigation that
 * stays on the page (the command palette asks for a new session from the team
 * page itself): `?new=retro|poker|whiteboard&template=<key>&deck=<id>`.
 * The query is then removed through Inertia, so that its page object and the
 * address bar agree. A reload that was already on its way answers with the
 * old URL: the query is removed again on each navigation that brings it back.
 * An intent read after the mount carries a `request` number, which is how
 * the dialog tells a second request from the first.
 */
export function useNewSessionIntent(): NewSessionIntent | null {
    const [intent, setIntent] = useState<NewSessionIntent | null>(() =>
        typeof window === 'undefined'
            ? null
            : readNewSessionIntent(window.location.search),
    );

    useEffect(() => {
        let requests = 0;

        const clean = (): boolean => {
            if (readNewSessionIntent(window.location.search) === null) {
                return false;
            }

            router.replace({
                url: withoutNewSessionIntent(window.location.href),
                preserveScroll: true,
                preserveState: true,
            });

            return true;
        };

        clean();

        return router.on('navigate', () => {
            const next = readNewSessionIntent(window.location.search);

            if (clean() && next !== null) {
                setIntent({ ...next, request: ++requests });
            }
        });
    }, []);

    return intent;
}
