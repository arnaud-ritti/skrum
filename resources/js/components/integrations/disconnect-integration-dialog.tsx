import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
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
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';

type Props = {
    scope: IntegrationScope;
    card: IntegrationProviderCard;
    connection: TeamIntegration;
    description: string;
    label?: string;
    title?: string;
};

export function DisconnectIntegrationDialog({
    scope,
    card,
    connection,
    description,
    label,
    title,
}: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    {label ?? t('Disconnect')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>
                    {title ??
                        t('Disconnect :provider?', { provider: card.label })}
                </DialogTitle>
                <DialogDescription>{description}</DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">{t('Cancel')}</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void disconnect()}
                    >
                        {busy && <Spinner />}
                        {label ?? t('Disconnect')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
