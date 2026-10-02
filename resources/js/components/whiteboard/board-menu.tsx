import { router } from '@inertiajs/react';
import {
    ArrowRightLeft,
    Copy,
    Crown,
    Ellipsis,
    LayoutTemplate,
    Pencil,
    Trash2,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import WhiteboardDuplicatesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardDuplicatesController';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { retroRequest } from '@/lib/retro/api';
import {
    DeleteBoardDialog,
    HandOverDialog,
    RenameBoardDialog,
    SaveTemplateDialog,
} from './board-dialogs';

type Props = {
    state: WhiteboardState;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
};

type BoardDialog = 'rename' | 'template' | 'handOver' | 'delete';

export function BoardMenu({
    state,
    hideMyCursor,
    onHideMyCursorChange,
}: Props) {
    const { t } = useTrans();
    const request = useWhiteboardRequest();
    const { board, me } = state.snapshot;
    const [dialog, setDialog] = useState<BoardDialog | null>(null);

    const run = async (pending: Promise<unknown>): Promise<void> => {
        if ((await request(pending)) === undefined) {
            return;
        }

        await state.refetch();
    };

    const updateSettings = (settings: Record<string, unknown>): Promise<void> =>
        run(
            retroRequest(
                WhiteboardSettingsController.update(board.id),
                settings,
            ),
        );

    const takeControl = (): Promise<void> =>
        run(
            retroRequest(WhiteboardFacilitatorsController.update(board.id), {
                user_id: me.userId,
            }),
        );

    const duplicate = async (): Promise<void> => {
        const copy = await request(
            retroRequest<{ url: string }>(
                WhiteboardDuplicatesController.store(board.id),
            ),
        );

        if (copy) {
            router.visit(copy.url);
        }
    };

    const dialogProps = (name: BoardDialog) => ({
        open: dialog === name,
        onOpenChange: (open: boolean) => setDialog(open ? name : null),
    });

    const groups: ReactNode[] = [
        <DropdownMenuCheckboxItem
            checked={hideMyCursor}
            onCheckedChange={onHideMyCursorChange}
        >
            <span className="truncate">{t('Hide my cursor')}</span>
        </DropdownMenuCheckboxItem>,
        !me.isGuest && (
            <>
                {me.canTakeControl && me.userId && (
                    <DropdownMenuItem onSelect={() => void takeControl()}>
                        <Crown aria-hidden />
                        <span className="truncate">{t('Take control')}</span>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void duplicate()}>
                    <Copy aria-hidden />
                    <span className="truncate">
                        {t('Duplicate this board')}
                    </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('template')}>
                    <LayoutTemplate aria-hidden />
                    <span className="truncate">{t('Save as template')}</span>
                </DropdownMenuItem>
            </>
        ),
        me.isFacilitator && (
            <>
                <DropdownMenuItem onSelect={() => setDialog('rename')}>
                    <Pencil aria-hidden />
                    <span className="truncate">{t('Rename')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog('handOver')}>
                    <ArrowRightLeft aria-hidden />
                    <span className="truncate">
                        {t('Hand over facilitation')}
                    </span>
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                    checked={board.cursorsEnabled}
                    onCheckedChange={(checked) =>
                        void updateSettings({ cursors_enabled: checked })
                    }
                >
                    <span className="truncate">{t('Show live cursors')}</span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={board.reactionsEnabled}
                    onCheckedChange={(checked) =>
                        void updateSettings({ reactions_enabled: checked })
                    }
                >
                    <span className="truncate">
                        {t('Show flying reactions')}
                    </span>
                </DropdownMenuCheckboxItem>
            </>
        ),
        me.canDelete && (
            <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDialog('delete')}
            >
                <Trash2 aria-hidden />
                <span className="truncate">{t('Delete this board')}</span>
            </DropdownMenuItem>
        ),
    ].filter(Boolean);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={t('Board menu')}
                        className="shrink-0"
                    >
                        <Ellipsis aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" size="wide">
                    {groups.map((group, index) => (
                        <Fragment key={index}>
                            {index > 0 && <DropdownMenuSeparator />}
                            {group}
                        </Fragment>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {me.isFacilitator && (
                <>
                    <RenameBoardDialog
                        state={state}
                        {...dialogProps('rename')}
                    />
                    <HandOverDialog
                        state={state}
                        {...dialogProps('handOver')}
                    />
                </>
            )}
            {!me.isGuest && (
                <SaveTemplateDialog
                    boardId={board.id}
                    {...dialogProps('template')}
                />
            )}
            {me.canDelete && (
                <DeleteBoardDialog state={state} {...dialogProps('delete')} />
            )}
        </>
    );
}
