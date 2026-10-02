import { router } from '@inertiajs/react';
import { Check, Copy, KeyRound, RefreshCw, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import WebhookSecretsController from '@/actions/App/Http/Controllers/Integrations/WebhookSecretsController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogIcon,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { IntegrationScope, TeamIntegration } from '@/types';

const VerificationSnippet = `signed   = X-Skrum-Timestamp + "." + raw request body
expected = "sha256=" + hex(HMAC-SHA256(secret, signed))
accept only if expected == X-Skrum-Signature
        and |now - X-Skrum-Timestamp| <= 300 seconds`;

type SecretDialogProps = {
    secret: string | null;
    onClose: () => void;
};

/**
 * The signing secret leaves the server only in the connect and rotate
 * responses, so this dialog is the one chance to copy it: it closes with its
 * button only.
 */
export function WebhookSecretDialog({ secret, onClose }: SecretDialogProps) {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const field = useRef<HTMLInputElement>(null);

    if (secret === null) {
        return null;
    }

    const copySecret = async () => {
        if (!(await copy(secret))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-xl"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    field.current?.focus();
                    field.current?.select();
                }}
            >
                <DialogHeader>
                    <DialogIcon>
                        <KeyRound />
                    </DialogIcon>
                    <DialogTitle>{t('Signing secret')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            "Copy this secret now. You won't be able to see it again.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-w-0 items-center gap-2">
                    <Input
                        ref={field}
                        readOnly
                        value={secret}
                        aria-label={t('Signing secret')}
                        className="min-w-0 flex-1 font-mono text-body-sm md:text-body-sm"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => void copySecret()}
                    >
                        {copied === secret ? (
                            <Check aria-hidden="true" />
                        ) : (
                            <Copy aria-hidden="true" />
                        )}
                        <span>
                            {copied === secret ? t('Copied') : t('Copy')}
                        </span>
                    </Button>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Verify each request: compute the signature with your secret and reject requests older than 5 minutes.',
                        )}
                    </p>
                    <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs">
                        {VerificationSnippet}
                    </pre>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        className="max-w-full min-w-0"
                        onClick={onClose}
                    >
                        <span className="truncate">
                            {t("I've saved the secret")}
                        </span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type RotateProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
    onRotated: (secret: string) => void;
};

/**
 * The confirmation is a plain dialog, not an alert dialog: the browser suite
 * finds its buttons under `[role="dialog"]`.
 */
export function RotateWebhookSecretButton({
    scope,
    connection,
    onRotated,
}: RotateProps) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);

    const changeOpen = (next: boolean) => {
        if (!next && busy) {
            return;
        }

        setOpen(next);
    };

    const rotate = async () => {
        setBusy(true);

        try {
            const response = await retroRequest<{ secret: string }>(
                WebhookSecretsController.store({
                    ...scope,
                    integration: connection.id,
                }),
            );
            setOpen(false);
            onRotated(response.secret);
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="max-w-full"
                    data-test="rotate-webhook-secret"
                >
                    <span className="truncate">{t('Rotate secret')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent
                size="sm"
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cancelRef.current?.focus();
                }}
                onEscapeKeyDown={(event) => {
                    if (busy) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogHeader>
                    <DialogIcon className="bg-skrum-destructive-soft text-skrum-destructive-text">
                        <TriangleAlert />
                    </DialogIcon>
                    <DialogTitle>{t('Rotate the signing secret?')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'The current secret stops working immediately. Update your endpoint with the new one.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        ref={cancelRef}
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => changeOpen(false)}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <LoadingButton
                        type="button"
                        variant="destructive"
                        loading={busy}
                        onClick={() => void rotate()}
                    >
                        <RefreshCw aria-hidden="true" />
                        <span className="truncate">{t('Rotate secret')}</span>
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
