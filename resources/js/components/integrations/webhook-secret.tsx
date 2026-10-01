import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import WebhookSecretsController from '@/actions/App/Http/Controllers/Integrations/WebhookSecretsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
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
 * responses, so this dialog is the one chance to copy it.
 */
export function WebhookSecretDialog({ secret, onClose }: SecretDialogProps) {
    const { t } = useTrans();
    const [, copy] = useClipboard();

    if (secret === null) {
        return null;
    }

    const copySecret = async () => {
        if (await copy(secret)) {
            toast(t('Secret copied.'));

            return;
        }

        toast.error(t('Something went wrong. Please try again.'));
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
                className="sm:max-w-xl"
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogTitle>{t('Signing secret')}</DialogTitle>
                <DialogDescription>
                    {t(
                        "Copy this secret now. You won't be able to see it again.",
                    )}
                </DialogDescription>
                <div className="flex gap-2">
                    <Input
                        readOnly
                        value={secret}
                        aria-label={t('Signing secret')}
                        className="font-mono"
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copySecret()}
                    >
                        {t('Copy')}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Verify each request: compute the signature with your secret and reject requests older than 5 minutes.',
                    )}
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                    {VerificationSnippet}
                </pre>
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t("I've saved the secret")}
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

export function RotateWebhookSecretButton({
    scope,
    connection,
    onRotated,
}: RotateProps) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    {t('Rotate secret')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>{t('Rotate the signing secret?')}</DialogTitle>
                <DialogDescription>
                    {t(
                        'The current secret stops working immediately. Update your endpoint with the new one.',
                    )}
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            {t('Cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void rotate()}
                    >
                        {busy && <Spinner />}
                        {t('Rotate secret')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
