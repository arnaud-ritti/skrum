import { Link, router, usePage } from '@inertiajs/react';
import { LayoutTemplate, PenTool, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import WhiteboardsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import { SectionActionsMenu } from '@/components/teams/section-actions-menu';
import { TeamSection } from '@/components/teams/team-section';
import { WhiteboardTemplatesDialog } from '@/components/teams/whiteboard-templates-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { WhiteboardSummary, WhiteboardTemplateSummary } from '@/types';

type Props = {
    workspaceSlug: string;
    boards: WhiteboardSummary[];
    templates: WhiteboardTemplateSummary[];
    /** Place left (TM-7): the thumbnail of a board, above its name. */
    thumbnailFor?: (board: WhiteboardSummary) => ReactNode;
};

export function TeamWhiteboardsSection({
    workspaceSlug,
    boards,
    templates,
    thumbnailFor,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [deleting, setDeleting] = useState<WhiteboardSummary | null>(null);
    const [managing, setManaging] = useState(false);
    const menuRef = useRef<HTMLButtonElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const deletedId = useRef<string | null>(null);
    const dialogOpen = deleting !== null;
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
    });

    // The button that opened the dialog leaves with its board: the focus goes
    // to the heading of the section once the reloaded list no longer holds it.
    useEffect(() => {
        if (deletedId.current === null) {
            return;
        }

        if (boards.some((board) => board.id === deletedId.current)) {
            return;
        }

        deletedId.current = null;
        headingRef.current?.focus();
    }, [boards]);

    const leaveDeletedBoard = (board: WhiteboardSummary): void => {
        deletedId.current = board.id;
        router.reload({ only: ['whiteboards'] });
    };

    const confirmDelete = async (): Promise<void> => {
        if (deleting === null) {
            return;
        }

        try {
            await retroRequest(WhiteboardsController.destroy(deleting.id));
        } catch (error) {
            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );

            if (error instanceof RetroRequestError && error.status === 404) {
                leaveDeletedBoard(deleting);

                return;
            }

            throw error;
        }

        leaveDeletedBoard(deleting);
    };

    return (
        <TeamSection
            icon={PenTool}
            title={t('Whiteboards')}
            count={boards.length}
            headingRef={headingRef}
            actions={
                <SectionActionsMenu
                    label={t('Whiteboards actions')}
                    triggerRef={menuRef}
                    items={[
                        {
                            label: t('Whiteboard templates'),
                            icon: LayoutTemplate,
                            onSelect: () => setManaging(true),
                        },
                    ]}
                />
            }
        >
            {boards.length === 0 && (
                <Card className="border-dashed shadow-none">
                    <EmptyState
                        module="whiteboard"
                        headingLevel="h3"
                        illustration={false}
                        title={t('No whiteboards yet.')}
                        description={t(
                            'Draw and map together: pick Whiteboard in New session.',
                        )}
                        className="py-6"
                    />
                </Card>
            )}
            {boards.length > 0 && (
                <ul
                    data-slot="team-whiteboards"
                    className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13.5rem),1fr))] gap-3"
                >
                    {boards.map((board) => (
                        <li key={board.id} className="flex min-w-0">
                            <Card className="relative w-full overflow-hidden transition-shadow duration-140 hover:shadow-raised has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring motion-reduce:transition-none">
                                <Link
                                    href={WhiteboardsController.show(board.id)}
                                    className="flex min-w-0 flex-1 flex-col outline-none after:absolute after:inset-0 after:rounded-xl"
                                >
                                    {thumbnailFor?.(board)}
                                    <span
                                        className={
                                            board.canDelete
                                                ? 'flex min-w-0 flex-col gap-0.5 py-3 pr-12 pl-4'
                                                : 'flex min-w-0 flex-col gap-0.5 px-4 py-3'
                                        }
                                    >
                                        <span className="truncate text-sm font-semibold">
                                            {board.title}
                                        </span>
                                        <span className="flex min-w-0 flex-wrap gap-x-1 text-xs text-muted-foreground">
                                            {board.facilitatorName && (
                                                <span className="max-w-full truncate">
                                                    {t('Facilitated by :name', {
                                                        name: board.facilitatorName,
                                                    })}
                                                    {board.updatedAt && ' · '}
                                                </span>
                                            )}
                                            {board.updatedAt && (
                                                <span
                                                    data-slot="whiteboard-date"
                                                    className="whitespace-nowrap"
                                                >
                                                    {formatDate.format(
                                                        new Date(
                                                            board.updatedAt,
                                                        ),
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </Link>
                                {board.canDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="absolute right-2 bottom-2.5 z-10"
                                        aria-label={t('Delete :title', {
                                            title: board.title,
                                        })}
                                        onClick={() => setDeleting(board)}
                                    >
                                        <Trash2 aria-hidden />
                                    </Button>
                                )}
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <WhiteboardTemplatesDialog
                open={managing}
                onOpenChange={setManaging}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    menuRef.current?.focus();
                }}
                workspaceSlug={workspaceSlug}
                templates={templates}
            />

            <ConfirmDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleting(null);
                    }
                }}
                tone="destructive"
                title={t('Delete this board?')}
                description={t('Everything on it is removed for everyone.')}
                confirmLabel={t('Delete this board')}
                onConfirm={confirmDelete}
            />
        </TeamSection>
    );
}
