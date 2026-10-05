import { Search } from 'lucide-react';
import {
    useEffect,
    useEffectEvent,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { KeyboardEvent } from 'react';
import { detectPlatform } from '@/components/skrum/keyboard-shortcuts';
import { Kbd } from '@/components/ui/kbd';
import { useShortcut } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const SearchDelayMs = 300;

function subscribeToNothing(): () => void {
    return () => {};
}

function termOf(text: string): string | null {
    const term = text.trim();

    return term === '' ? null : term;
}

/**
 * The mockup's search of the action items page (P24-07): the list follows the
 * field 300 ms after the last key; mod+K focuses it on this page.
 */
export function ActionItemSearchField({
    value,
    onSearch,
    shortcut = true,
    submitPendingOnUnmount = false,
    className,
}: {
    value: string | null;
    onSearch: (term: string | null) => void;
    shortcut?: boolean;
    /** For a field that closes with its container (the phone drawer). */
    submitPendingOnUnmount?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const input = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(value ?? '');
    const [sent, setSent] = useState<string | null>(value);
    const [seen, setSeen] = useState<string | null>(value);
    const platform = useSyncExternalStore(
        subscribeToNothing,
        detectPlatform,
        () => 'mac' as const,
    );

    if (seen !== value) {
        setSeen(value);

        if (value !== sent) {
            setSent(value);
            setDraft(value ?? '');
        }
    }

    const submit = (term: string | null): void => {
        setSent(term);
        onSearch(term);
    };
    const submitLater = useEffectEvent((term: string | null) => submit(term));

    useEffect(() => {
        const term = termOf(draft);

        if (term === sent) {
            return;
        }

        const timer = window.setTimeout(() => submitLater(term), SearchDelayMs);

        return () => window.clearTimeout(timer);
    }, [draft, sent]);

    const pending = useRef({ draft, sent, onSearch });

    useEffect(() => {
        pending.current = { draft, sent, onSearch };
    });

    useEffect(() => {
        if (!submitPendingOnUnmount) {
            return;
        }

        const latest = pending;

        return () => {
            const term = termOf(latest.current.draft);

            if (term !== termOf(latest.current.sent ?? '')) {
                latest.current.onSearch(term);
            }
        };
    }, [submitPendingOnUnmount]);

    useShortcut(
        'mod+k',
        () => {
            input.current?.focus();
            input.current?.select();
        },
        { enabled: shortcut, enableOnFormTags: true },
    );

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Enter') {
            const term = termOf(draft);

            if (term !== sent) {
                submit(term);
            }

            return;
        }

        if (event.key !== 'Escape' || draft === '') {
            return;
        }

        event.stopPropagation();
        setDraft('');
        submit(null);
    };

    return (
        <div
            data-slot="action-item-search"
            className={cn(
                'relative flex w-full min-w-0 items-center',
                className,
            )}
        >
            <Search
                aria-hidden
                className="pointer-events-none absolute start-3 size-4 text-muted-foreground"
            />
            <input
                ref={input}
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                aria-label={t('Search action items')}
                aria-keyshortcuts={shortcut ? 'Meta+K Control+K' : undefined}
                placeholder={t('Search an action item, a ticket…')}
                className={cn(
                    'flex h-9 w-full min-w-0 rounded-md border border-input bg-card ps-9 text-base text-foreground shadow-xs transition-[color,box-shadow,border-color] duration-140 ease-standard outline-none placeholder:text-muted-foreground md:text-sm',
                    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring',
                    '[&::-webkit-search-cancel-button]:hidden',
                    shortcut ? 'pe-14' : 'pe-3',
                )}
            />
            {shortcut && (
                <Kbd aria-hidden className="pointer-events-none absolute end-2">
                    {platform === 'mac' ? '⌘K' : 'Ctrl K'}
                </Kbd>
            )}
        </div>
    );
}
