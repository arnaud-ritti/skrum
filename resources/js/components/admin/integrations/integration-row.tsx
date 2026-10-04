import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import IntegrationSettingsController from '@/actions/App/Http/Controllers/Admin/IntegrationSettingsController';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderKey,
    IntegrationProviderSettings,
} from '@/lib/admin/types';
import { cn } from '@/lib/utils';
import { IntegrationAppDialog } from './integration-app-dialog';
import { TurnOffDialog } from './turn-off-dialog';

/** The mockup's marks: Jira on the info tile, Linear on a round foreground tile, the others plain. */
const MarkClasses: Partial<Record<IntegrationProviderKey, string>> = {
    jira: 'border-transparent bg-skrum-info text-skrum-info-foreground',
    jira_dc: 'border-transparent bg-skrum-info text-skrum-info-foreground',
    linear: 'rounded-full border-transparent bg-foreground text-background',
};

export type IntegrationRowProps = {
    provider: IntegrationProviderSettings;
    /** Every provider turned off here: a switch sends the whole list. */
    disabled: string[];
    /**
     * A switch of the card is saving. One at a time: each sends the whole
     * list, which the next one must read once the page has reloaded.
     */
    saving: boolean;
    onSavingChange: (saving: boolean) => void;
    needsConfirmation: boolean;
    confirmUrl: string;
    onConfirmationRefused: () => void;
};

/** One provider of the Integrations card: its state, its app credentials, its switch. */
export function IntegrationRow({
    provider,
    disabled,
    saving,
    onSavingChange,
    needsConfirmation,
    confirmUrl,
    onConfirmationRefused,
}: IntegrationRowProps) {
    const { t } = useTrans();
    const id = useId();
    const nameId = `${id}-name`;
    const stateId = `${id}-state`;
    const [configuring, setConfiguring] = useState(false);
    const [askingToTurnOff, setAskingToTurnOff] = useState(false);
    const [dialogKey, setDialogKey] = useState('');
    const others = disabled.filter((key) => key !== provider.key);

    function stateLine(): { text: string; className: string } {
        if (!provider.configured) {
            return {
                text: t('Not configured'),
                className: 'text-muted-foreground',
            };
        }

        if (!provider.enabled) {
            return {
                text: t('Turned off'),
                className: 'text-muted-foreground',
            };
        }

        return {
            text:
                provider.connectedTeams === 1
                    ? t('Available · 1 team connected')
                    : t('Available · :count teams connected', {
                          count: provider.connectedTeams,
                      }),
            className: 'text-skrum-success-text',
        };
    }

    /** Settles once the visit ends, cancelled or failed visits included. */
    function send(nextDisabled: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            let saved = false;

            router.put(
                IntegrationSettingsController.update.url(),
                { disabled: nextDisabled },
                {
                    preserveScroll: true,
                    onStart: () => onSavingChange(true),
                    onSuccess: () => {
                        saved = true;
                    },
                    onError: (errors) =>
                        toast.error(
                            Object.values(errors)[0] ??
                                t('Something went wrong. Please try again.'),
                        ),
                    onFinish: () => {
                        onSavingChange(false);

                        if (saved) {
                            resolve();

                            return;
                        }

                        reject(new Error('not saved'));
                    },
                },
            );
        });
    }

    function toggle(checked: boolean): void {
        if (checked) {
            void send(others).catch(() => {});

            return;
        }

        if (provider.connectedTeams > 0) {
            setAskingToTurnOff(true);

            return;
        }

        void send([...others, provider.key]).catch(() => {});
    }

    const state = stateLine();

    return (
        <div
            data-slot="integration-row"
            className="flex min-w-0 items-center gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
            <span
                aria-hidden="true"
                className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-md border bg-card text-sm font-extrabold',
                    MarkClasses[provider.key],
                )}
            >
                {provider.label.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span id={nameId} className="truncate text-sm font-semibold">
                    {provider.label}
                </span>
                <span id={stateId} className={cn('text-xs', state.className)}>
                    {state.text}
                </span>
            </span>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-describedby={nameId}
                onClick={() => {
                    setDialogKey(JSON.stringify(provider.fields));
                    setConfiguring(true);
                }}
            >
                {t('Configure')}
            </Button>
            <Switch
                checked={provider.enabled}
                onCheckedChange={toggle}
                disabled={!provider.configured || saving}
                aria-labelledby={nameId}
                aria-describedby={stateId}
            />
            <IntegrationAppDialog
                key={dialogKey}
                provider={provider}
                open={configuring}
                onOpenChange={setConfiguring}
                needsConfirmation={needsConfirmation}
                confirmUrl={confirmUrl}
                onConfirmationRefused={onConfirmationRefused}
            />
            <TurnOffDialog
                name={provider.label}
                connectedTeams={provider.connectedTeams}
                open={askingToTurnOff}
                onOpenChange={setAskingToTurnOff}
                onConfirm={() => send([...others, provider.key])}
            />
        </div>
    );
}
