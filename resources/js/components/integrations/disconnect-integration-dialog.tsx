import { router } from '@inertiajs/react';
import { TriangleAlert, Unplug } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
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
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import type { DisconnectControl } from './provider-card';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
    description: string;
    label?: string;
    title?: string;
    /** Opened from outside, by the switch of the row: no trigger of its own. */
    control?: DisconnectControl;
};

/**
 * The confirmation is a plain dialog, not an alert dialog: the browser suite
 * finds its buttons under `[role="dialog"]`.
 */
export function DisconnectIntegrationDialog({
    scope,
    card,
    connection,
    description,
    label,
    title,
    control,
}: Props) {
    const { t } = useTrans();
    const [ownOpen, setOwnOpen] = useState(false);
    const open = control?.open ?? ownOpen;
    const setOpen = control?.onOpenChange ?? setOwnOpen;
    const restoreFocus = useRestoreFocus(open);
    const [busy, setBusy] = useState(false);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const action = label ?? t('Disconnect');

    const changeOpen = (next: boolean) => {
        if (!next && busy) {
            return;
        }

        setOpen(next);
    };

    const disconnect = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.destroy({
                    ...scope,
                    integration: connection.id,
                }),
            );
            setOpen(false);
            toast.success(
                t(':provider disconnected.', { provider: card.label }),
            );
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
            {control === undefined && (
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ms-auto max-w-full border-[color-mix(in_oklch,var(--destructive)_45%,var(--input))] text-skrum-destructive-text hover:text-skrum-destructive-text"
                    >
                        <Unplug aria-hidden="true" />
                        <span className="truncate">{action}</span>
                    </Button>
                </DialogTrigger>
            )}
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
                onCloseAutoFocus={
                    control === undefined ? undefined : restoreFocus
                }
            >
                <DialogHeader>
                    <DialogIcon className="bg-skrum-destructive-soft text-skrum-destructive-text">
                        <TriangleAlert />
                    </DialogIcon>
                    <DialogTitle>
                        {title ??
                            t('Disconnect :provider?', {
                                provider: card.label,
                            })}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
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
                        onClick={() => void disconnect()}
                    >
                        <Unplug aria-hidden="true" />
                        <span className="truncate">{action}</span>
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
