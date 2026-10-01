import { Link, usePage } from '@inertiajs/react';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import Heading from '@/components/heading';
import { useTrans } from '@/hooks/use-trans';
import type { WhiteboardSummary } from '@/types';
import { NewWhiteboardDialog } from './new-whiteboard-dialog';

type Props = {
    workspaceSlug: string;
    teamId: string;
    boards: WhiteboardSummary[];
    canCreate: boolean;
};

export function WhiteboardsSection({
    workspaceSlug,
    teamId,
    boards,
    canCreate,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const formatDate = new Intl.DateTimeFormat(locale as string, {
        dateStyle: 'medium',
    });

    return (
        <section className="space-y-3">
            <Heading variant="small" title={t('Whiteboards')} />

            {canCreate && (
                <NewWhiteboardDialog
                    workspaceSlug={workspaceSlug}
                    teamId={teamId}
                />
            )}

            {boards.length === 0 && (
                <p className="text-muted-foreground">
                    {t('No whiteboards yet.')}
                </p>
            )}

            {boards.length > 0 && (
                <ul className="divide-y rounded-md border">
                    {boards.map((board) => (
                        <li key={board.id}>
                            <Link
                                href={WhiteboardsController.show(board.id)}
                                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
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
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
