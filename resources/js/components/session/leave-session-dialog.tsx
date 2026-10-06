import { router } from '@inertiajs/react';
import { CircleStop, LogOut } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** A way out of the session: its name, and under it what it does. */
const ChoiceClass =
    'flex w-full items-start gap-3 rounded-lg border p-3 text-left outline-none transition-colors duration-140 ease-standard hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none';

type LeaveSessionDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The session's own title: written by a user, never translated. */
    title: string;
    /** People in the session, the viewer included. */
    peopleCount: number;
    backHref: string;
    /** What ending costs beyond closing, already translated. */
    endNote?: string;
    /** Ends the session for everyone; a rejection keeps the viewer in. */
    onEnd: () => Promise<void>;
};

/**
 * What the back arrow asks who may end a live session: two ways out, each
 * with its consequence under it, the one that ends the session second and
 * drawn as the destructive one; staying is the dialog's own button.
 */
export function LeaveSessionDialog({
    open,
    onOpenChange,
    title,
    peopleCount,
    backHref,
    endNote,
    onEnd,
}: LeaveSessionDialogProps) {
    const { t } = useTrans();
    const id = useId();
    const stay = useRef<HTMLButtonElement>(null);
    const [ending, setEnding] = useState(false);
    const [failed, setFailed] = useState(false);

    const change = (next: boolean) => {
        if (ending) {
            return;
        }

        setFailed(false);
        onOpenChange(next);
    };

    const end = async () => {
        setEnding(true);
        setFailed(false);

        try {
            await onEnd();
        } catch {
            setFailed(true);
            setEnding(false);

            return;
        }

        router.visit(backHref);
    };

    const hasCompany = peopleCount > 1;

    return (
        <Dialog open={open} onOpenChange={change}>
            <DialogContent
                closeLabel={t('Close')}
                {...(hasCompany ? {} : { 'aria-describedby': undefined })}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    stay.current?.focus();
                }}
            >
                <DialogHeader className="pr-8">
                    <DialogTitle className="break-words">
                        {t('Leave :title?', { title })}
                    </DialogTitle>
                    {hasCompany && (
                        <DialogDescription>
                            {t(
                                'The session is still running for :count people.',
                                { count: peopleCount },
                            )}
                        </DialogDescription>
                    )}
                </DialogHeader>
                {failed && (
                    <Alert variant="destructive">
                        {t('Something went wrong. Please try again.')}
                    </Alert>
                )}
                <div className="grid gap-2">
                    <button
                        type="button"
                        disabled={ending}
                        aria-labelledby={`${id}-leave`}
                        aria-describedby={`${id}-leave-note`}
                        onClick={() => router.visit(backHref)}
                        className={ChoiceClass}
                    >
                        <LogOut
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="grid min-w-0 gap-0.5">
                            <span id={`${id}-leave`} className="font-medium">
                                {t('Leave, the session continues')}
                            </span>
                            <span
                                id={`${id}-leave-note`}
                                className="text-sm text-muted-foreground"
                            >
                                {t('It keeps running. You can come back.')}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        disabled={ending}
                        aria-labelledby={`${id}-end`}
                        aria-describedby={`${id}-end-note`}
                        onClick={() => void end()}
                        className={cn(
                            ChoiceClass,
                            'border-destructive hover:bg-skrum-destructive-soft',
                        )}
                    >
                        {ending ? (
                            <Spinner className="mt-0.5 shrink-0 text-skrum-destructive-text" />
                        ) : (
                            <CircleStop
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-skrum-destructive-text"
                            />
                        )}
                        <span className="grid min-w-0 gap-0.5">
                            <span
                                id={`${id}-end`}
                                className="font-medium text-skrum-destructive-text"
                            >
                                {t('End the session')}
                            </span>
                            <span
                                id={`${id}-end-note`}
                                className="text-sm text-muted-foreground"
                            >
                                {t('It closes for everyone.')}
                                {endNote !== undefined && ` ${endNote}`}
                            </span>
                        </span>
                    </button>
                </div>
                <DialogFooter>
                    <Button
                        ref={stay}
                        type="button"
                        variant="outline"
                        disabled={ending}
                        onClick={() => change(false)}
                    >
                        {t('Stay')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
