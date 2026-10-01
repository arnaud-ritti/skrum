import { router, usePage } from '@inertiajs/react';
import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import WhiteboardVersionCopiesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionCopiesController';
import WhiteboardVersionRestoresController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionRestoresController';
import WhiteboardVersionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardState } from '@/hooks/use-whiteboard';
import { useWhiteboardRequest } from '@/hooks/use-whiteboard-request';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { WhiteboardVersionSummary } from '@/lib/whiteboard/types';
import { VersionPreview } from './version-preview';

type Props = {
    state: WhiteboardState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The board was rewritten: this tab has to fetch what the others were sent. */
    onRestored: () => void;
};

type Asked = {
    kind: 'restore' | 'rename' | 'delete';
    version: WhiteboardVersionSummary;
};

export function HistoryPanel({ state, open, onOpenChange, onRestored }: Props) {
    const { t } = useTrans();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full gap-4 overflow-y-auto p-4 sm:max-w-md"
                aria-describedby={undefined}
            >
                <SheetTitle>{t('Version history')}</SheetTitle>
                {open && <History state={state} onRestored={onRestored} />}
            </SheetContent>
        </Sheet>
    );
}

function History({ state, onRestored }: Pick<Props, 'state' | 'onRestored'>) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const request = useWhiteboardRequest();
    const { board, me } = state.snapshot;
    const [versions, setVersions] = useState<WhiteboardVersionSummary[] | null>(
        null,
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [previewed, setPreviewed] = useState<WhiteboardVersionSummary | null>(
        null,
    );
    const [asked, setAsked] = useState<Asked | null>(null);
    const dates = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    const labelOf = (version: WhiteboardVersionSummary) =>
        version.name ?? t('Automatic version');
    const dateOf = (version: WhiteboardVersionSummary) =>
        dates.format(new Date(version.createdAt));
    const failure = t('Something went wrong. Please try again.');

    const load = useCallback(async () => {
        setLoadError(null);

        try {
            setVersions(
                await retroRequest<WhiteboardVersionSummary[]>(
                    WhiteboardVersionsController.index(board.id),
                ),
            );
        } catch (error) {
            setVersions(null);
            setLoadError(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : failure,
            );
        }
    }, [board.id, failure]);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setNameError(undefined);

        try {
            await retroRequest(WhiteboardVersionsController.store(board.id), {
                name,
            });
            toast.success(t('Version saved.'));
            setName('');
            await load();
        } catch (error) {
            setNameError(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : failure,
            );
        } finally {
            setSaving(false);
        }
    };

    const copy = async (version: WhiteboardVersionSummary) => {
        const copied = await request(
            retroRequest<{ url: string }>(
                WhiteboardVersionCopiesController.store({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (copied) {
            router.visit(copied.url);
        }
    };

    const restore = async (version: WhiteboardVersionSummary) => {
        const done = await request(
            retroRequest(
                WhiteboardVersionRestoresController.store({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (done === undefined) {
            return;
        }

        toast.success(t('Version restored.'));
        setAsked(null);
        onRestored();
        await load();
    };

    const remove = async (version: WhiteboardVersionSummary) => {
        const done = await request(
            retroRequest(
                WhiteboardVersionsController.destroy({
                    board: board.id,
                    version: version.id,
                }),
            ),
        );

        if (done === undefined) {
            return;
        }

        setAsked(null);
        await load();
    };

    return (
        <>
            <form onSubmit={save} className="space-y-2">
                <div className="flex gap-2">
                    <Input
                        required
                        maxLength={80}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-label={t('Version name')}
                        placeholder={t('Version name')}
                    />
                    <Button disabled={saving || name.trim() === ''}>
                        {t('Save this version')}
                    </Button>
                </div>
                <InputError message={nameError} />
            </form>

            {loadError !== null && (
                <div className="space-y-2">
                    <p role="alert" className="text-sm text-muted-foreground">
                        {loadError}
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void load()}
                    >
                        {t('Retry')}
                    </Button>
                </div>
            )}

            {loadError === null && versions === null && (
                <div className="space-y-2" aria-busy="true">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            )}

            {versions !== null && versions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No version yet.')}
                </p>
            )}

            {versions !== null && versions.length > 0 && (
                <ul className="space-y-2">
                    {versions.map((version) => (
                        <li
                            key={version.id}
                            className="flex items-center gap-2 rounded-md border p-2"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {labelOf(version)}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {dateOf(version)}
                                    {version.createdByName !== null &&
                                        ` · ${t('by :name', { name: version.createdByName })}`}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewed(version)}
                            >
                                {t('Preview')}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Version actions')}
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onSelect={() => void copy(version)}
                                    >
                                        {t('Copy to a new board')}
                                    </DropdownMenuItem>
                                    {me.isFacilitator && (
                                        <>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'restore',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Restore')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'rename',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Rename')}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={() =>
                                                    setAsked({
                                                        kind: 'delete',
                                                        version,
                                                    })
                                                }
                                            >
                                                {t('Delete')}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    ))}
                </ul>
            )}

            <VersionPreview
                boardId={board.id}
                version={previewed}
                title={previewed === null ? '' : labelOf(previewed)}
                date={previewed === null ? '' : dateOf(previewed)}
                onClose={() => setPreviewed(null)}
            />

            <Dialog
                open={asked?.kind === 'restore'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent>
                    <DialogTitle>{t('Restore this version?')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'The board goes back to this version for everyone. The current state is saved first.',
                        )}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAsked(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            onClick={() => asked && void restore(asked.version)}
                        >
                            {t('Restore')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={asked?.kind === 'delete'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle>{t('Delete this version?')}</DialogTitle>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setAsked(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => asked && void remove(asked.version)}
                        >
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={asked?.kind === 'rename'}
                onOpenChange={(open) => !open && setAsked(null)}
            >
                <DialogContent aria-describedby={undefined}>
                    {asked?.kind === 'rename' && (
                        <RenameVersionForm
                            boardId={board.id}
                            version={asked.version}
                            onRenamed={() => {
                                setAsked(null);
                                void load();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function RenameVersionForm({
    boardId,
    version,
    onRenamed,
}: {
    boardId: string;
    version: WhiteboardVersionSummary;
    onRenamed: () => void;
}) {
    const { t } = useTrans();
    const [name, setName] = useState(version.name ?? '');
    const [error, setError] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(undefined);

        try {
            await retroRequest(
                WhiteboardVersionsController.update({
                    board: boardId,
                    version: version.id,
                }),
                { name },
            );
            onRenamed();
        } catch (failure) {
            setError(
                failure instanceof RetroRequestError && failure.status > 0
                    ? failure.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('Rename')}</DialogTitle>
            <Input
                required
                maxLength={80}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label={t('Version name')}
            />
            <InputError message={error} />
            <DialogFooter>
                <Button disabled={saving || name.trim() === ''}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
