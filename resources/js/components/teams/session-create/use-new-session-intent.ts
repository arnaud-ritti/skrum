import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export type SessionType = 'retro' | 'poker' | 'whiteboard' | 'icebreaker';

export type NewSessionIntent = {
    type: SessionType;
    template?: string;
    deck?: string;
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
 * Read once from the URL: `?new=retro|poker|whiteboard&template=<key>&deck=<id>`.
 * The query is then removed through Inertia, so that its page object and the
 * address bar agree. A reload that was already on its way answers with the
 * old URL: the query is removed again on each navigation that brings it back.
 */
export function useNewSessionIntent(): NewSessionIntent | null {
    const [intent] = useState<NewSessionIntent | null>(() =>
        typeof window === 'undefined'
            ? null
            : readNewSessionIntent(window.location.search),
    );

    useEffect(() => {
        if (intent === null) {
            return;
        }

        const clean = (): void => {
            if (readNewSessionIntent(window.location.search) === null) {
                return;
            }

            router.replace({
                url: withoutNewSessionIntent(window.location.href),
                preserveScroll: true,
                preserveState: true,
            });
        };

        clean();

        return router.on('navigate', clean);
    }, [intent]);

    return intent;
}
