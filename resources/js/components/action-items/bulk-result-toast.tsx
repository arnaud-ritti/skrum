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

export type BulkResultKind = 'update' | 'delete';

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
    ) => void;
    details: ReactNode;
} {
    const { t } = useTrans();
    const [shown, setShown] = useState<{
        kind: BulkResultKind;
        refused: BulkRefusal[];
    } | null>(null);

    const fullSuccess = (kind: BulkResultKind, done: number): string => {
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
    ): void => {
        if (refused.length === 0) {
            toast.success(fullSuccess(kind, done));

            return;
        }

        toast.warning(
            kind === 'update'
                ? t(':changed updated, :refused not changed.', {
                      changed: done,
                      refused: refused.length,
                  })
                : t(':deleted deleted, :refused not deleted.', {
                      deleted: done,
                      refused: refused.length,
                  }),
            {
                action: {
                    label: t('Details'),
                    onClick: () => setShown({ kind, refused }),
                },
            },
        );
    };

    const details = (
        <Dialog
            open={shown !== null}
            onOpenChange={(open) => {
                if (!open) {
                    setShown(null);
                }
            }}
        >
            <DialogContent size="sm" closeLabel={t('Close')}>
                <DialogHeader>
                    <DialogTitle>
                        {shown?.kind === 'delete'
                            ? t('Action items not deleted')
                            : t('Action items not changed')}
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
