import { Download } from 'lucide-react';
import { SessionPresence } from '@/components/session/session-presence';
import { SessionTitle } from '@/components/session/session-title';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useUpdateWhiteboardSettings } from '@/hooks/use-whiteboard-request';
import { presenceOf } from '@/lib/presence/presence-color';
import type { PresenceMember } from '@/lib/retro/types';
import { BoardMenu } from './board-menu';
import type { BoardCanvasActions } from './board-menu';
import { BoardShare } from './board-share';
import { TitleMaxLength } from '@/components/whiteboard/board-dialogs';

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

/** "team · Whiteboard", above the name. A guest is not told the team. */
function useBoardOverline(snapshot: BoardSnapshot): string {
    const { t } = useTrans();
    const { teamName } = snapshot.board;

    return teamName === null
        ? t('Whiteboard')
        : `${teamName} · ${t('Whiteboard')}`;
}

/**
 * The board's name under its team (the arrow of the header leads back to
 * the team), renamed in place by who may rename it (the facilitator).
 */
export function BoardTitle({ state }: { state: WhiteboardState }) {
    const { t } = useTrans();
    const updateSettings = useUpdateWhiteboardSettings(state);
    const { board, me } = state.snapshot;
    const overline = useBoardOverline(state.snapshot);

    const rename = async (title: string): Promise<void> => {
        if (!(await updateSettings({ title }))) {
            throw new Error('The board was not renamed.');
        }
    };

    return (
        <SessionTitle
            overline={overline}
            subtitle={`${t('Whiteboard')} · ${t(':count online', { count: state.online.length })}`}
            onRename={me.isFacilitator ? rename : undefined}
            renameLabel={t('Rename the board')}
            nameLabel={t('Board name')}
            nameMaxLength={TitleMaxLength}
        >
            {board.title}
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
            className="shrink-0 flex-nowrap max-[22.5rem]:hidden"
        />
    );
}

type BoardActionsProps = {
    state: WhiteboardState;
    /** Opens the Export dialog; absent until the canvas is ready. */
    onExport?: () => void;
    /** The entries of the library's hidden menu; absent until the canvas is ready. */
    canvasActions?: BoardCanvasActions;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
    /**
     * The bar has no room for the secondary controls: Export and the
     * keyboard shortcuts are entries of the menu. Share stays.
     */
    folded?: boolean;
};

/** Right of the header: Export, Share and the board menu. */
export function BoardActions({
    state,
    onExport,
    canvasActions,
    hideMyCursor,
    onHideMyCursorChange,
    folded = false,
}: BoardActionsProps) {
    const { t } = useTrans();
    const isPhone = useIsMobile();
    const { me } = state.snapshot;

    return (
        <>
            {!folded && (
                <Button
                    type="button"
                    variant="outline"
                    aria-label={t('Export')}
                    aria-disabled={onExport === undefined || undefined}
                    onClick={() => onExport?.()}
                    className="shrink-0 @max-session-words/session:size-9 @max-session-words/session:px-0"
                >
                    <Download aria-hidden />
                    <span className="sr-only @session-words/session:not-sr-only @session-words/session:truncate">
                        {t('Export')}
                    </span>
                </Button>
            )}
            {!me.isGuest && <BoardShare state={state} />}
            <BoardMenu
                state={state}
                hideMyCursor={hideMyCursor}
                onHideMyCursorChange={onHideMyCursorChange}
                canvasActions={canvasActions}
                folded={folded && !isPhone}
                onExport={onExport}
            />
        </>
    );
}
