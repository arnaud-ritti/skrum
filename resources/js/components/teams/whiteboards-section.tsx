import { Link, router, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { WhiteboardSummary, WhiteboardTemplateSummary } from '@/types';
import { WhiteboardTemplatesDialog } from './whiteboard-templates-dialog';

type Props = {
    workspaceSlug: string;
    boards: WhiteboardSummary[];
    templates: WhiteboardTemplateSummary[];
};

export function WhiteboardsSection({
    workspaceSlug,
    boards,
    templates,
}: Props) {
    const { t } = useTrans();
    const [deleting, setDeleting] = useState<WhiteboardSummary | null>(null);
    const [processing, setProcessing] = useState(false);
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale as string, {
        dateStyle: 'medium',
    });

    const confirmDelete = async () => {
        if (deleting === null) {
            return;
        }

        setProcessing(true);

        try {
            await retroRequest(WhiteboardsController.destroy(deleting.id));
            router.reload({ only: ['whiteboards'] });
            setDeleting(null);
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <section className="space-y-3">
            <Heading variant="small" title={t('Whiteboards')} />

            <div className="flex flex-wrap gap-2">
                <WhiteboardTemplatesDialog
                    workspaceSlug={workspaceSlug}
                    templates={templates}
                />
            </div>

            {boards.length === 0 && (
                <p className="text-muted-foreground">
                    {t('No whiteboards yet.')}
                </p>
            )}

            {boards.length > 0 && (
                <ul className="divide-y rounded-md border">
                    {boards.map((board) => (
                        <li key={board.id} className="flex items-center">
                            <Link
                                href={WhiteboardsController.show(board.id)}
                                className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                            >
                                <span className="font-medium">
                                    {board.title}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    {board.facilitatorName &&
                                        t('Facilitated by :name', {
                                            name: board.facilitatorName,
                                        })}
                                    {board.facilitatorName &&
                                        board.updatedAt &&
                                        ' · '}
                                    {board.updatedAt &&
                                        formatDate.format(
                                            new Date(board.updatedAt),
                                        )}
                                </span>
                            </Link>
                            {board.canDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="mr-2 shrink-0"
                                    aria-label={t('Delete :title', {
                                        title: board.title,
                                    })}
                                    onClick={() => setDeleting(board)}
                                >
                                    <Trash2 />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <Dialog
                open={deleting !== null}
                onOpenChange={(open) => {
                    if (!open && !processing) {
                        setDeleting(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogTitle>{t('Delete this board?')}</DialogTitle>
                    <DialogDescription>
                        {t('Everything on it is removed for everyone.')}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="secondary"
                            disabled={processing}
                            onClick={() => setDeleting(null)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={processing}
                            onClick={confirmDelete}
                        >
                            {t('Delete this board')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
