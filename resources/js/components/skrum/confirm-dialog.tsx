import { InfoIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogIcon,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';

export type DialogConsequence = { icon: LucideIcon; label: string };

type DialogShellProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    unavailableMessage?: string;
};

export type ConfirmDialogProps = DialogShellProps & {
    description: string;
    consequences?: DialogConsequence[];
    confirmLabel: string;
    tone?: 'default' | 'destructive';
    onConfirm: () => Promise<void>;
};

export type FormDialogProps = DialogShellProps & {
    description?: string;
    submitLabel: string;
    onSubmit: (data: FormData) => Promise<void>;
    children: ReactNode;
};

function usePendingGuard(onOpenChange: (open: boolean) => void) {
    const [pending, setPending] = useState(false);

    const guardedOpenChange = (open: boolean) => {
        if (!open && pending) {
            return;
        }

        onOpenChange(open);
    };

    const run = async (action: () => Promise<void>) => {
        setPending(true);

        try {
            await action();
            onOpenChange(false);
        } catch {
            return;
        } finally {
            setPending(false);
        }
    };

    return { pending, guardedOpenChange, run };
}

function UnavailableDialog({
    open,
    onOpenChange,
    title,
    message,
    restoreFocus,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    message: string;
    restoreFocus: (event: Event) => void;
}) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                closeLabel={t('Close')}
                data-test="dialog-unavailable"
                onCloseAutoFocus={restoreFocus}
            >
                <DialogHeader>
                    <DialogIcon>
                        <InfoIcon />
                    </DialogIcon>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{message}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button>{t('Close')}</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    consequences,
    confirmLabel,
    tone = 'default',
    onConfirm,
    unavailableMessage,
}: ConfirmDialogProps) {
    const { t } = useTrans();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const { pending, guardedOpenChange, run } = usePendingGuard(onOpenChange);
    const restoreFocus = useRestoreFocus(open);
    const destructive = tone === 'destructive';

    if (unavailableMessage !== undefined) {
        return (
            <UnavailableDialog
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                message={unavailableMessage}
                restoreFocus={restoreFocus}
            />
        );
    }

    return (
        <Dialog open={open} onOpenChange={guardedOpenChange}>
            <DialogContent
                role="alertdialog"
                showCloseButton={false}
                closeLabel={t('Close')}
                onCloseAutoFocus={restoreFocus}
                onInteractOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => {
                    if (pending) {
                        event.preventDefault();
                    }
                }}
                onOpenAutoFocus={(event) => {
                    if (!destructive) {
                        return;
                    }

                    event.preventDefault();
                    cancelRef.current?.focus();
                }}
            >
                <DialogHeader>
                    {destructive && (
                        <DialogIcon className="bg-skrum-destructive-soft text-skrum-destructive-text">
                            <TriangleAlertIcon />
                        </DialogIcon>
                    )}
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {consequences !== undefined && consequences.length > 0 && (
                    <ul
                        data-slot="dialog-consequences"
                        className="grid gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground"
                    >
                        {consequences.map(({ icon: Icon, label }) => (
                            <li key={label} className="flex items-start gap-2">
                                <Icon
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span className="min-w-0">{label}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <DialogFooter>
                    <Button
                        ref={cancelRef}
                        variant="outline"
                        type="button"
                        disabled={pending}
                        onClick={() => guardedOpenChange(false)}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={pending}
                        onClick={() => run(onConfirm)}
                    >
                        {pending ? (
                            <Spinner aria-label={t('Loading')} />
                        ) : (
                            destructive && <Trash2Icon aria-hidden="true" />
                        )}
                        <span className="truncate">{confirmLabel}</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    submitLabel,
    onSubmit,
    children,
    unavailableMessage,
}: FormDialogProps) {
    const { t } = useTrans();
    const { pending, guardedOpenChange, run } = usePendingGuard(onOpenChange);
    const restoreFocus = useRestoreFocus(open);

    if (unavailableMessage !== undefined) {
        return (
            <UnavailableDialog
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                message={unavailableMessage}
                restoreFocus={restoreFocus}
            />
        );
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (pending) {
            return;
        }

        const data = new FormData(event.currentTarget);

        void run(() => onSubmit(data));
    };

    return (
        <Dialog open={open} onOpenChange={guardedOpenChange}>
            <DialogContent
                closeLabel={t('Close')}
                onCloseAutoFocus={restoreFocus}
                {...(description === undefined
                    ? { 'aria-describedby': undefined }
                    : {})}
                onEscapeKeyDown={(event) => {
                    if (pending) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (pending) {
                        event.preventDefault();
                    }
                }}
            >
                <form
                    onSubmit={submit}
                    aria-busy={pending}
                    className="grid gap-4"
                >
                    <DialogHeader className="pr-8">
                        <DialogTitle>{title}</DialogTitle>
                        {description !== undefined && (
                            <DialogDescription>{description}</DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="grid gap-4">{children}</div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            onClick={() => guardedOpenChange(false)}
                        >
                            <span className="truncate">{t('Cancel')}</span>
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <Spinner aria-label={t('Loading')} />}
                            <span className="truncate">{submitLabel}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
