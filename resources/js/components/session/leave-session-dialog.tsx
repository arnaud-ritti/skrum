import { router } from '@inertiajs/react';
import { useState } from 'react';
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
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** The label is the button's own text and truncates: three buttons share the footer. */
const FooterButtonClass = 'inline-block max-w-full min-w-0 truncate';

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
 * What the back arrow asks who may end a live session: stay, leave it running,
 * or end it for everyone.
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

    return (
        <Dialog open={open} onOpenChange={change}>
            <DialogContent closeLabel={t('Close')}>
                <DialogHeader className="pr-8">
                    <DialogTitle className="break-words">
                        {t('Leave :title?', { title })}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="grid gap-1">
                            {peopleCount > 1 && (
                                <p>
                                    {t(
                                        'The session is still running for :count people.',
                                        { count: peopleCount },
                                    )}
                                </p>
                            )}
                            <p>
                                {t(
                                    'Leave: it keeps running, you can come back.',
                                )}
                            </p>
                            <p>
                                {t('End: it closes for everyone.')}
                                {endNote !== undefined && ` ${endNote}`}
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                {failed && (
                    <Alert variant="destructive">
                        {t('Something went wrong. Please try again.')}
                    </Alert>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={ending}
                        onClick={() => change(false)}
                        className={cn(FooterButtonClass, 'sm:mr-auto')}
                    >
                        {t('Stay')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={ending}
                        onClick={() => router.visit(backHref)}
                        className={FooterButtonClass}
                    >
                        {t('Leave, keep running')}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={ending}
                        onClick={() => void end()}
                        className={FooterButtonClass}
                    >
                        {t('End it')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
