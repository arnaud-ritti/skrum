import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { BulkRefusal } from '@/lib/action-items/bulk';

export type BulkResultKind = 'update' | 'delete' | 'export';

/**
 * The toast after a bulk change (decision 1, P24-05): the count alone when
 * nothing was refused, otherwise both counts and "Details", which lists each
 * refused item. The dialog outlives the bar, which hides once nothing is
 * selected.
 */
export function useBulkResultToast(): {
    report: (
        kind: BulkResultKind,
        done: number,
        refused: BulkRefusal[],
        skipped?: number,
    ) => void;
    details: ReactNode;
} {
    const { t } = useTrans();
    // The last details stay while the dialog closes, so it does not empty
    // during its exit animation.
    const [shown, setShown] = useState<{
        kind: BulkResultKind;
        refused: BulkRefusal[];
    } | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const fullSuccess = (
        kind: BulkResultKind,
        done: number,
        skipped: number,
    ): string => {
        if (kind === 'export' && skipped > 0) {
            return t(':exported exported, :skipped already linked.', {
                exported: done,
                skipped,
            });
        }

        if (kind === 'export') {
            return done === 1
                ? t('1 action item exported.')
                : t(':count action items exported.', { count: done });
        }

        if (kind === 'update') {
            return done === 1
                ? t('1 action item updated.')
                : t(':count action items updated.', { count: done });
        }

        return done === 1
            ? t('1 action item deleted.')
            : t(':count action items deleted.', { count: done });
    };

    const report = (
        kind: BulkResultKind,
        done: number,
        refused: BulkRefusal[],
        skipped = 0,
    ): void => {
        if (refused.length === 0) {
            toast.success(fullSuccess(kind, done, skipped));

            return;
        }

        const sentences: Record<BulkResultKind, string> = {
            update: t(':changed updated, :refused not changed.', {
                changed: done,
                refused: refused.length,
            }),
            delete: t(':deleted deleted, :refused not deleted.', {
                deleted: done,
                refused: refused.length,
            }),
            export: t(
                ':exported exported, :skipped already linked, :failed failed.',
                {
                    exported: done,
                    skipped,
                    failed: refused.length,
                },
            ),
        };

        toast.warning(sentences[kind], {
            action: {
                label: t('Details'),
                onClick: () => {
                    setShown({ kind, refused });
                    setDetailsOpen(true);
                },
            },
        });
    };

    const details = (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent size="sm" closeLabel={t('Close')}>
                <DialogHeader>
                    <DialogTitle>
                        {shown?.kind === 'delete' &&
                            t('Action items not deleted')}
                        {shown?.kind === 'export' &&
                            t('Action items not exported')}
                        {shown?.kind === 'update' &&
                            t('Action items not changed')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'Each of these was left as it was, for this reason.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <ul
                    data-slot="bulk-refusals"
                    className="grid max-h-80 gap-2 overflow-y-auto"
                >
                    {shown?.refused.map((refusal) => (
                        <li
                            key={refusal.id}
                            className="grid gap-0.5 rounded-lg bg-muted p-3 text-sm"
                        >
                            {refusal.title !== null && (
                                <span className="font-semibold wrap-anywhere">
                                    {refusal.title}
                                </span>
                            )}
                            <span className="text-muted-foreground">
                                {refusal.message}
                            </span>
                        </li>
                    ))}
                </ul>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            {t('Close')}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { report, details };
}
