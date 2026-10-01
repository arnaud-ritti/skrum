import { router } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import WhiteboardDuplicatesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardDuplicatesController';
import WhiteboardFacilitatorsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFacilitatorsController';
import WhiteboardGuestTokensController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardGuestTokensController';
import WhiteboardSettingsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSettingsController';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { HandOverDialog } from '@/components/whiteboard/hand-over-dialog';
import { SaveTemplateDialog } from '@/components/whiteboard/save-template-dialog';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';

type Props = {
    state: WhiteboardState;
    hideMyCursor: boolean;
    onHideMyCursorChange: (hidden: boolean) => void;
    onShowResults: () => void;
};

export function BoardMenu({
    state,
    hideMyCursor,
    onHideMyCursorChange,
    onShowResults,
}: Props) {
    const { t } = useTrans();
    const { board, me, links, voting, votingHistory } = state.snapshot;
    const hasResults =
        votingHistory.length > 0 || (voting !== null && !voting.open);
    const [renaming, setRenaming] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [handingOver, setHandingOver] = useState(false);

    /** Resolves to whether the request went through; says why when it did not. */
    const attempt = async (request: Promise<unknown>): Promise<boolean> => {
        try {
            await request;

            return true;
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );

            return false;
        }
    };

    const run = async (request: Promise<unknown>): Promise<boolean> => {
        if (!(await attempt(request))) {
            return false;
        }

        await state.refetch();

        return true;
    };

    const updateSettings = (settings: Record<string, unknown>) =>
        run(
            retroRequest(
                WhiteboardSettingsController.update(board.id),
                settings,
            ),
        );

    const copyGuestLink = async () => {
        if (!board.guestUrl) {
            return;
        }

        await navigator.clipboard.writeText(board.guestUrl);
        toast.success(t('Link copied.'));
    };

    const duplicate = async () => {
        try {
            const { url } = await retroRequest<{ url: string }>(
                WhiteboardDuplicatesController.store(board.id),
            );

            router.visit(url);
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );
        }
    };

    const deleteBoard = async () => {
        const deleted = await attempt(
            retroRequest(WhiteboardsController.destroy(board.id)),
        );

        if (!deleted) {
            return;
        }

        if (links.team) {
            router.visit(links.team);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="outline"
                        aria-label={t('Board menu')}
                    >
                        <Menu className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                        checked={hideMyCursor}
                        onCheckedChange={onHideMyCursorChange}
                    >
                        {t('Hide my cursor')}
                    </DropdownMenuCheckboxItem>
                    {me.canTakeControl && me.userId && (
                        <DropdownMenuItem
                            onSelect={() =>
                                run(
                                    retroRequest(
                                        WhiteboardFacilitatorsController.update(
                                            board.id,
                                        ),
                                        { user_id: me.userId },
                                    ),
                                )
                            }
                        >
                            {t('Take control')}
                        </DropdownMenuItem>
                    )}
                    {!me.isGuest && (
                        <>
                            <DropdownMenuItem
                                disabled={board.privateWriting}
                                onSelect={duplicate}
                            >
                                {t('Duplicate this board')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={board.privateWriting}
                                onSelect={() => setSavingTemplate(true)}
                            >
                                {t('Save as template')}
                            </DropdownMenuItem>
                            {hasResults && (
                                <DropdownMenuItem onSelect={onShowResults}>
                                    {t('Vote results')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    {me.isFacilitator && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => setRenaming(true)}
                            >
                                {t('Rename')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={() => setHandingOver(true)}
                            >
                                {t('Hand over facilitation')}
                            </DropdownMenuItem>
                            <DropdownMenuCheckboxItem
                                checked={board.cursorsEnabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({ cursors_enabled: checked })
                                }
                            >
                                {t('Show live cursors')}
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={board.reactionsEnabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({
                                        reactions_enabled: checked,
                                    })
                                }
                            >
                                {t('Show flying reactions')}
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={board.guestAccessEnabled}
                                onCheckedChange={(checked) =>
                                    updateSettings({
                                        guest_access_enabled: checked,
                                    })
                                }
                            >
                                {t('Allow guests to join with a link')}
                            </DropdownMenuCheckboxItem>
                            {board.guestAccessEnabled && (
                                <DropdownMenuItem
                                    onSelect={() =>
                                        run(
                                            retroRequest(
                                                WhiteboardGuestTokensController.store(
                                                    board.id,
                                                ),
                                            ),
                                        )
                                    }
                                >
                                    {t('Replace the guest link')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                    {!me.isGuest && board.guestAccessEnabled && (
                        <DropdownMenuItem onSelect={copyGuestLink}>
                            {t('Copy the guest link')}
                        </DropdownMenuItem>
                    )}
                    {me.canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setConfirmingDelete(true)}
                            >
                                {t('Delete this board')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={renaming} onOpenChange={setRenaming}>
                <DialogContent aria-describedby={undefined}>
                    {renaming && (
                        <RenameForm
                            title={board.title}
                            onSubmit={async (title) => {
                                if (await updateSettings({ title })) {
                                    setRenaming(false);
                                }
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <SaveTemplateDialog
                boardId={board.id}
                open={savingTemplate}
                onOpenChange={setSavingTemplate}
            />

            <HandOverDialog
                state={state}
                open={handingOver}
                onOpenChange={setHandingOver}
            />

            <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Delete this board?')}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {t('Everything on it is removed for everyone.')}
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button variant="destructive" onClick={deleteBoard}>
                            {t('Delete this board')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function RenameForm({
    title,
    onSubmit,
}: {
    title: string;
    onSubmit: (title: string) => Promise<void>;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState(title);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void onSubmit(value);
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Rename')}</DialogTitle>
            <Input
                required
                maxLength={120}
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-label={t('Title')}
            />
            <DialogFooter>
                <Button>{t('Save')}</Button>
            </DialogFooter>
        </form>
    );
}
