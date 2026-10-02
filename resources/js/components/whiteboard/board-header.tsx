import { Download, Pencil } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionTitle } from '@/components/session/session-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import { presenceFor } from '@/lib/whiteboard/presence-slot';
import { BoardFacilitation } from './board-facilitation';
import { BoardMenu } from './board-menu';
import { BoardShare } from './board-share';

const TitleMaxLength = 120;
const FromMd = '(min-width: 768px)';
const FromXl = '(min-width: 1280px)';

function useMatches(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);

            list.addEventListener('change', onChange);

            return () => list.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
        () => true,
    );
}

/** From `md` the facilitator's tools are in the header; below, under it. */
export function useFacilitationInHeader(): boolean {
    return useMatches(FromMd);
}

/**
 * The board's name, renamed in place by who may rename it (the facilitator):
 * a press on it, or F2, turns it into a field; Enter saves, Escape cancels.
 */
export function BoardTitle({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const { board, me, links } = state.snapshot;
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const restoreFocus = useRef(false);
    const isEditing = draft !== null;

    useEffect(() => {
        if (isEditing || !restoreFocus.current) {
            return;
        }

        restoreFocus.current = false;
        trigger.current?.focus();
    }, [isEditing]);

    const close = (): void => {
        restoreFocus.current = true;
        setDraft(null);
    };

    const save = async (): Promise<void> => {
        const title = (draft ?? '').trim();

        if (saving) {
            return;
        }

        if (title === '' || title === board.title) {
            close();

            return;
        }

        setSaving(true);

        const done = await request(
            retroRequest(WhiteboardSettingsController.update(board.id), {
                title,
            }),
        );

        if (done !== undefined) {
            await state.refetch();
            close();
        }

        setSaving(false);
    };

    const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void save();

            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
        if (event.key !== 'F2') {
            return;
        }

        event.preventDefault();
        setDraft(board.title);
    };

    if (!me.isFacilitator) {
        return <SessionTitle backHref={links.team}>{board.title}</SessionTitle>;
    }

    return (
        <SessionTitle
            backHref={links.team}
            badges={
                !isEditing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('Rename the board')}
                        aria-keyshortcuts="F2"
                        onClick={() => setDraft(board.title)}
                        onKeyDown={onTriggerKeyDown}
                        className="hidden shrink-0 md:inline-flex"
                    >
                        <Pencil aria-hidden />
                    </Button>
                )
            }
        >
            {isEditing ? (
                <span className="block p-1">
                    <Input
                        autoFocus
                        required
                        maxLength={TitleMaxLength}
                        value={draft}
                        disabled={saving}
                        aria-label={t('Board name')}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        onBlur={() => !saving && setDraft(null)}
                        onFocus={(event) => event.target.select()}
                        className="h-8 w-64 max-w-full text-base font-semibold"
                    />
                </span>
            ) : (
                <span className="block p-1">
                    <button
                        ref={trigger}
                        type="button"
                        title={t('Rename the board')}
                        aria-keyshortcuts="F2"
                        onClick={() => setDraft(board.title)}
                        onKeyDown={onTriggerKeyDown}
                        className="block max-w-full truncate rounded-sm text-left outline-offset-2 outline-ring hover:bg-accent focus-visible:outline-2"
                    >
                        {board.title}
                    </button>
                </span>
            )}
        </SessionTitle>
    );
}

export function BoardPresence({
    state,
    follow,
}: {
    state: WhiteboardState;
    /** Place left for the "Follow :name" pill (roadmap WB-3). */
    follow?: ReactNode;
}) {
    const { board, me } = state.snapshot;

    return (
        <>
            <SessionPresence
                online={state.online}
                selfId={me.id}
                facilitatorId={board.facilitatorMemberId}
                presenceFor={presenceFor}
                className="shrink-0 flex-nowrap"
            />
            {follow}
        </>
    );
}

export type BoardActionsProps = {
    state: WhiteboardState;
    /** Opens the canvas's export dialog; absent until the canvas is ready. */
    onExport?: () => void;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
    /** The sticky tool, when the canvas's own toolbar has no room for it. */
    sticky?: ReactNode;
    /** Place left for the "Comments" button (roadmap WB-2). */
    comments?: ReactNode;
};

/** Right of the header: facilitation tools, Export, Share and the board menu. */
export function BoardActions({
    state,
    onExport,
    hideMyCursor,
    onHideMyCursorChange,
    sticky,
    comments,
}: BoardActionsProps) {
    const { t } = useTrans();
    const { me } = state.snapshot;
    const facilitationInHeader = useFacilitationInHeader();
    const hasRoomForLabels = useMatches(FromXl);

    return (
        <>
            {me.isFacilitator && facilitationInHeader && (
                <BoardFacilitation state={state} compact={!hasRoomForLabels} />
            )}
            {sticky}
            <span
                aria-hidden
                data-slot="board-header-separator"
                className="hidden h-6 w-px shrink-0 bg-border md:block"
            />
            {comments}
            <Button
                type="button"
                variant="outline"
                aria-label={t('Export')}
                aria-disabled={onExport === undefined || undefined}
                onClick={() => onExport?.()}
                className="hidden shrink-0 max-lg:size-9 max-lg:px-0 md:inline-flex"
            >
                <Download aria-hidden />
                <span className="truncate max-lg:sr-only">{t('Export')}</span>
            </Button>
            {!me.isGuest && <BoardShare state={state} />}
            <BoardMenu
                state={state}
                hideMyCursor={hideMyCursor}
                onHideMyCursorChange={onHideMyCursorChange}
            />
        </>
    );
}
