import { Lock, RotateCcw, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import RetroHealthCheckClosuresController from '@/actions/App/Http/Controllers/Retros/RetroHealthCheckClosuresController';
import RetroHealthChecksController from '@/actions/App/Http/Controllers/Retros/RetroHealthChecksController';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { HealthCheckForm } from '@/components/skrum/health-check-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { toHealthStatements } from '@/lib/retro/adapters';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { HealthResult } from './results/health';
import { useHealthCheckSubmission } from './use-health-check-submission';
import type { HealthCheckSubmission } from './use-health-check-submission';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type Confirming = 'close' | 'remove' | null;

/**
 * While open: the form, sent at once. Once closed: the results, to everyone.
 * The unsent scores live in the dialog, which stays mounted when it closes.
 */
function HealthCheckBody({
    submission: { answers, setAnswer, submit, submitting },
}: {
    submission: HealthCheckSubmission;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const healthCheck = ctx.board.healthCheck;

    if (healthCheck === null) {
        return null;
    }

    if (healthCheck.isClosed) {
        return healthCheck.results === null ? (
            <p className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground">
                {t('No answers.')}
            </p>
        ) : (
            <HealthResult health={healthCheck.results} trend={null} />
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {!ctx.isEditable && (
                <p className="flex items-start gap-1.5 text-body-sm text-muted-foreground">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                        {t('The board is closed for editing.')}
                    </span>
                </p>
            )}
            <HealthCheckForm
                className="min-w-0"
                retroTitle={ctx.board.retro.title}
                statements={toHealthStatements(ctx.board)}
                scale={healthCheck.scale}
                answers={answers}
                disabled={!ctx.isEditable}
                submitted={healthCheck.hasSubmitted}
                submitting={submitting}
                onAnswer={setAnswer}
                onSubmit={() => void submit()}
            />
        </div>
    );
}

/**
 * For the facilitator of a named retro while it is open: how many have sent
 * their answers and their avatars, as "Who has voted" shows the ROTI voters.
 * The server names them to nobody else.
 */
function WhoHasSent() {
    const { board } = useBoard();
    const { t } = useTrans();
    const titleId = useId();
    const healthCheck = board.healthCheck;

    if (
        healthCheck === null ||
        healthCheck.isClosed ||
        board.retro.isAnonymous ||
        !board.viewer.isFacilitator
    ) {
        return null;
    }

    const senderIds = new Set(healthCheck.submittedBy);

    if (healthCheck.hasSubmitted) {
        senderIds.add(board.viewer.participantId);
    }

    const senders = board.participants.filter((participant) =>
        senderIds.has(participant.id),
    );
    const count = t(':answered of :total have sent their answers', {
        answered: healthCheck.respondents,
        total: healthCheck.participants,
    });

    return (
        <section
            aria-labelledby={titleId}
            data-slot="health-check-senders"
            className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
        >
            <div className="flex min-w-0 items-center justify-between gap-2">
                <h3
                    id={titleId}
                    className="min-w-0 truncate text-body-sm font-semibold"
                >
                    {t('Who has sent their answers')}
                </h3>
                <Badge
                    variant="success"
                    shape="pill"
                    className="shrink-0 tabular-nums"
                >
                    <span aria-hidden>
                        {healthCheck.respondents}/{healthCheck.participants}
                    </span>
                    <span className="sr-only">{count}</span>
                </Badge>
            </div>
            <Progress
                value={healthCheck.respondents}
                max={Math.max(1, healthCheck.participants)}
                tone="success"
                valueLabel=""
                aria-label={count}
                aria-valuetext={count}
            />
            {senders.length > 0 && (
                <AvatarStack
                    size="sm"
                    max={12}
                    people={senders.map((sender) => ({
                        name: sender.name,
                        src: sender.avatarUrl,
                        kind: sender.isGuest ? 'guest' : 'member',
                    }))}
                />
            )}
        </section>
    );
}

/** For the facilitator: "Close the health check" and "Remove" while open, "Reopen" once closed. */
function FacilitatorActions({ onRemoved }: { onRemoved: () => void }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [confirming, setConfirming] = useState<Confirming>(null);
    const [busy, setBusy] = useState(false);
    const { board } = ctx;
    const healthCheck = board.healthCheck;
    const retroId = board.retro.id;

    if (healthCheck === null || !board.viewer.isFacilitator) {
        return null;
    }

    const send = async (
        request: Parameters<typeof retroRequest>[0],
    ): Promise<boolean> => {
        setBusy(true);

        const response = await ctx.run(retroRequest(request).then(() => true));

        if (response) {
            await ctx.refetch();
        }

        setBusy(false);

        return response === true;
    };

    const close = async () => {
        await send(RetroHealthCheckClosuresController.update(retroId));
    };

    const remove = async () => {
        if (await send(RetroHealthChecksController.destroy(retroId))) {
            onRemoved();
        }
    };

    return (
        <div
            data-slot="health-check-facilitator"
            className="flex flex-wrap items-center justify-end gap-2"
        >
            {!healthCheck.isClosed && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirming('remove')}
                >
                    <Trash2 aria-hidden />
                    <span className="truncate">{t('Remove')}</span>
                </Button>
            )}
            {healthCheck.isClosed ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                        void send(
                            RetroHealthCheckClosuresController.destroy(retroId),
                        )
                    }
                >
                    <RotateCcw aria-hidden />
                    <span className="truncate">{t('Reopen')}</span>
                </Button>
            ) : (
                <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirming('close')}
                >
                    <span className="truncate">
                        {t('Close the health check')}
                    </span>
                </Button>
            )}
            <ConfirmDialog
                open={confirming === 'close'}
                onOpenChange={(next) => setConfirming(next ? 'close' : null)}
                title={t('Close the health check')}
                description={t('Everyone will see the results.')}
                confirmLabel={t('Close the health check')}
                onConfirm={close}
            />
            <ConfirmDialog
                open={confirming === 'remove'}
                onOpenChange={(next) => setConfirming(next ? 'remove' : null)}
                title={t('Remove the health check')}
                description={t(
                    'Any answers it holds are kept and come back if you add it again.',
                )}
                confirmLabel={t('Remove')}
                tone="destructive"
                onConfirm={remove}
            />
        </div>
    );
}

/**
 * The retro's health check, opened from the header: a dialog, a drawer on a
 * phone. It can be answered in every open phase.
 */
export function HealthCheckDialog({ open, onOpenChange }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const submission = useHealthCheckSubmission();
    const healthCheck = ctx.board.healthCheck;

    if (healthCheck === null) {
        return null;
    }

    const title = t('Health check · :retro', { retro: ctx.board.retro.title });
    // The open form carries the same heading: the title is then only read.
    const titleClass = cn(!healthCheck.isClosed && 'sr-only');
    const body: ReactNode = (
        <div className="flex min-w-0 flex-col gap-4">
            <HealthCheckBody submission={submission} />
            <WhoHasSent />
            <FacilitatorActions onRemoved={() => onOpenChange(false)} />
        </div>
    );
    const isOpen = open && !ctx.sessionExpired;

    if (isMobile) {
        return (
            <Drawer open={isOpen} onOpenChange={onOpenChange}>
                <DrawerContent
                    aria-describedby={undefined}
                    data-slot="retro-health-check-drawer"
                    className="scrollbar-themed overflow-y-auto"
                >
                    <DrawerHeader className={cn('pr-10 text-left', titleClass)}>
                        <DrawerTitle>{title}</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-4">{body}</div>
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                data-slot="retro-health-check-dialog"
                className="sm:max-w-2xl"
            >
                <DialogHeader className={titleClass}>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                {body}
            </DialogContent>
        </Dialog>
    );
}
