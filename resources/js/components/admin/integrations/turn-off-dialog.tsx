import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { useTrans } from '@/hooks/use-trans';

type TurnOffDialogProps = {
    name: string;
    connectedTeams: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
};

/** Before turning off a provider that teams use: their integrations are kept, not deleted. */
export function TurnOffDialog({
    name,
    connectedTeams,
    open,
    onOpenChange,
    onConfirm,
}: TurnOffDialogProps) {
    const { t } = useTrans();

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={onOpenChange}
            tone="destructive"
            title={t('Turn :name off?', { name })}
            description={
                connectedTeams === 1
                    ? t(
                          '1 team loses it until you turn it back on. Its settings are kept.',
                      )
                    : t(
                          ':count teams lose it until you turn it back on. Their settings are kept.',
                          { count: connectedTeams },
                      )
            }
            confirmLabel={t('Turn off')}
            onConfirm={onConfirm}
        />
    );
}
