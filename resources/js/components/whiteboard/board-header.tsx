import { Download, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionTitle } from '@/components/session/session-title';
import type { SessionCrumb } from '@/components/session/session-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useUpdateWhiteboardSettings } from '@/hooks/use-whiteboard-request';
import { presenceOf } from '@/lib/presence/presence-color';
import type { PresenceMember } from '@/lib/retro/types';
import { BoardFacilitation } from './board-facilitation';
import { BoardMenu } from './board-menu';
import type { BoardCanvasActions } from './board-menu';
import { BoardShare } from './board-share';
import { TitleMaxLength } from '@/components/whiteboard/board-dialogs';

/** From `md` the facilitator's tools are in the header; below, under it. */
export function useFacilitationInHeader(): boolean {
    return useMinWidth(768);
}

type BoardSnapshot = Pick<
    WhiteboardState['snapshot'],
    'board' | 'me' | 'links'
>;

/**
 * The viewer as the end of the header shows them, in their own colour: the
 * one their roster entry carries, a colour drawn from their id until the
 * channel is up.
 */
export function boardSelf(snapshot: BoardSnapshot, online: PresenceMember[]) {
    const { me } = snapshot;

    return {
        name: me.name,
        avatarUrl: me.avatarUrl,
        isGuest: me.isGuest,
        presence: presenceOf(
            online.find((member) => member.id === me.id) ?? { id: me.id },
        ),
    };
}

/** "team › Whiteboards", before the name. A guest is not told the team and follows no link. */
function useBoardCrumbs(snapshot: BoardSnapshot): SessionCrumb[] {
    const { t } = useTrans();
    const { board, links } = snapshot;
    const boards: SessionCrumb = {
        label: t('Whiteboards'),
        href: links.sessions,
    };

    return board.teamName === null
        ? [boards]
        : [{ label: board.teamName, href: links.team }, boards];
}

/**
 * The board's name at the end of its breadcrumb (the logo of the header leads
 * back to the team), renamed in place by who may rename it (the facilitator):
 * a press on it, or F2, turns it into a field; Enter saves, and so does
 * leaving the field with a changed name; Escape cancels. While it saves the
 * field is read-only, not disabled, so it keeps the focus if the save fails.
 */
export function BoardTitle({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const updateSettings = useUpdateWhiteboardSettings(state);
    const { board, me } = state.snapshot;
    const crumbs = useBoardCrumbs(state.snapshot);
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const field = useRef<HTMLInputElement>(null);
    const restoreFocus = useRef(false);
    const isClosing = useRef(false);
    const isEditing = draft !== null;

    useEffect(() => {
        if (isEditing || !restoreFocus.current) {
            return;
        }

        restoreFocus.current = false;
        trigger.current?.focus();
    }, [isEditing]);

    const open = (): void => {
        isClosing.current = false;
        setDraft(board.title);
    };

    /** Leaving the field by itself sends the focus nowhere: it is already elsewhere. */
    const close = (toTrigger = true): void => {
        isClosing.current = true;
        restoreFocus.current = toTrigger;
        setDraft(null);
    };

    const save = async (toTrigger = true): Promise<void> => {
        const title = (draft ?? '').trim();

        if (saving || isClosing.current) {
            return;
        }

        if (title === '' || title === board.title) {
            close(toTrigger);

            return;
        }

        setSaving(true);

        if (await updateSettings({ title })) {
            close(toTrigger && document.activeElement === field.current);
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
        open();
    };

    const subtitle = `${t('Whiteboard')} · ${t(':count online', { count: state.online.length })}`;

    if (!me.isFacilitator) {
        return (
            <SessionTitle crumbs={crumbs} subtitle={subtitle}>
                {board.title}
            </SessionTitle>
        );
    }

    return (
        <SessionTitle
            crumbs={crumbs}
            subtitle={subtitle}
            badges={
                !isEditing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('Rename the board')}
                        aria-keyshortcuts="F2"
                        onClick={open}
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
                        ref={field}
                        autoFocus
                        required
                        maxLength={TitleMaxLength}
                        value={draft}
                        readOnly={saving}
                        aria-busy={saving || undefined}
                        aria-label={t('Board name')}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        onBlur={() => void save(false)}
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
                        aria-description={t('Rename the board')}
                        aria-keyshortcuts="F2"
                        onClick={open}
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

export function BoardPresence({ state }: { state: WhiteboardState }) {
    const { board, me } = state.snapshot;

    return (
        <SessionPresence
            online={state.online}
            selfId={me.id}
            facilitatorId={board.facilitatorMemberId}
            phoneAvatars={2}
            className="shrink-0 flex-nowrap"
        />
    );
}

type BoardActionsProps = {
    state: WhiteboardState;
    /** Opens the canvas's export dialog; absent until the canvas is ready. */
    onExport?: () => void;
    /** The entries of the library's hidden menu; absent until the canvas is ready. */
    canvasActions?: BoardCanvasActions;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
};

/** Right of the header: facilitation tools, Export, Share and the board menu. */
export function BoardActions({
    state,
    onExport,
    canvasActions,
    hideMyCursor,
    onHideMyCursorChange,
}: BoardActionsProps) {
    const { t } = useTrans();
    const { me } = state.snapshot;
    const facilitationInHeader = useFacilitationInHeader();
    /** The facilitation tools show their labels from here: below, the breadcrumb and the name keep the room. */
    const hasRoomForLabels = useMinWidth(1536);

    return (
        <>
            {me.isFacilitator && facilitationInHeader && (
                <BoardFacilitation state={state} compact={!hasRoomForLabels} />
            )}
            <span
                aria-hidden
                data-slot="board-header-separator"
                className="hidden h-6 w-px shrink-0 bg-border md:block"
            />
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
                canvasActions={canvasActions}
            />
        </>
    );
}
