import { Ellipsis } from 'lucide-react';
import { useRef, useState } from 'react';
import ColumnOrdersController from '@/actions/App/Http/Controllers/Retros/ColumnOrdersController';
import ColumnsController from '@/actions/App/Http/Controllers/Retros/ColumnsController';
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import {
    ColumnColors,
    columnColorLabel,
    columnSwatch,
} from '@/lib/retro/colors';
import type { BoardColumn, ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

type Props = {
    column: BoardColumn;
    count: number;
    index: number;
    total: number;
    hasCards: boolean;
};

export function ColumnHeader({ column, count, index, total, hasCards }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(column.title);
    const [busy, setBusy] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const settled = useRef(false);
    const canEdit =
        ctx.board.viewer.isFacilitator && ctx.board.retro.phase === 'writing';

    const applyColumns = async (
        request: Promise<{ columns: BoardColumn[] }>,
    ) => {
        if (busy) {
            return undefined;
        }

        setBusy(true);
        const response = await ctx.run(request);
        setBusy(false);

        if (response) {
            ctx.apply({ type: 'columns.set', columns: response.columns });
        }

        return response;
    };

    const update = (data: { title?: string; color?: ColumnColor }) =>
        applyColumns(
            retroRequest<{ columns: BoardColumn[] }>(
                ColumnsController.update({
                    retro: ctx.board.retro.id,
                    column: column.id,
                }),
                data,
            ),
        );

    const startRename = () => {
        settled.current = false;
        setDraft(column.title);
        setEditing(true);
    };

    const finishRename = (save: boolean) => {
        if (settled.current) {
            return;
        }

        settled.current = true;
        setEditing(false);

        const trimmed = draft.trim();

        if (save && trimmed !== '' && trimmed !== column.title) {
            void update({ title: trimmed });
        }
    };

    const move = async (offset: -1 | 1) => {
        const ids = ctx.board.columns.map((item) => item.id);
        const from = ids.indexOf(column.id);
        [ids[from], ids[from + offset]] = [ids[from + offset], ids[from]];

        await applyColumns(
            retroRequest<{ columns: BoardColumn[] }>(
                ColumnOrdersController.update(ctx.board.retro.id),
                { column_ids: ids },
            ),
        );
    };

    const destroy = async () => {
        const response = await applyColumns(
            retroRequest<{ columns: BoardColumn[] }>(
                ColumnsController.destroy({
                    retro: ctx.board.retro.id,
                    column: column.id,
                }),
            ),
        );

        if (response) {
            setConfirmingDelete(false);
        }
    };

    return (
        <header className="mb-3 flex items-center justify-between gap-2">
            {editing ? (
                <Input
                    autoFocus
                    value={draft}
                    maxLength={60}
                    aria-label={t('Column title')}
                    className="h-8"
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => finishRename(true)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            finishRename(true);
                        }

                        if (event.key === 'Escape') {
                            finishRename(false);
                        }
                    }}
                />
            ) : (
                <h2 className="min-w-0 truncate font-medium">{column.title}</h2>
            )}
            <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{count}</span>
                {canEdit && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                aria-label={t('Column menu')}
                            >
                                <Ellipsis className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            onCloseAutoFocus={(event) => event.preventDefault()}
                        >
                            <DropdownMenuItem
                                disabled={busy || hasCards}
                                onSelect={startRename}
                            >
                                {t('Rename')}
                            </DropdownMenuItem>
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                {t('Color')}
                            </DropdownMenuLabel>
                            <div className="flex gap-1 px-2 pb-1.5">
                                {ColumnColors.map((option) => (
                                    <DropdownMenuItem
                                        key={option}
                                        disabled={busy || hasCards}
                                        role="menuitemradio"
                                        aria-checked={column.color === option}
                                        aria-label={t(columnColorLabel[option])}
                                        className="size-6 justify-center rounded-full p-0"
                                        onSelect={() =>
                                            void update({ color: option })
                                        }
                                    >
                                        <span
                                            className={cn(
                                                'size-4 rounded-full',
                                                columnSwatch[option],
                                                column.color === option &&
                                                    'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                                            )}
                                        />
                                    </DropdownMenuItem>
                                ))}
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                disabled={busy || index === 0}
                                onSelect={() => void move(-1)}
                            >
                                {t('Move left')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={busy || index >= total - 1}
                                onSelect={() => void move(1)}
                            >
                                {t('Move right')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                disabled={busy || hasCards}
                                onSelect={() => setConfirmingDelete(true)}
                            >
                                {t('Delete column')}
                            </DropdownMenuItem>
                            {hasCards && (
                                <p className="max-w-48 px-2 py-1 text-xs text-muted-foreground">
                                    {t(
                                        'Only empty columns can be edited or deleted.',
                                    )}
                                </p>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            {canEdit && (
                <Dialog
                    open={confirmingDelete}
                    onOpenChange={setConfirmingDelete}
                >
                    <DialogContent>
                        <DialogTitle>{t('Delete column')}</DialogTitle>
                        <DialogDescription>
                            {t('Delete the column :title?', {
                                title: column.title,
                            })}
                        </DialogDescription>
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setConfirmingDelete(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={busy}
                                onClick={() => void destroy()}
                            >
                                {t('Delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </header>
    );
}
