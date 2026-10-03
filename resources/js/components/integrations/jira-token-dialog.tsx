import { router } from '@inertiajs/react';
import { TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import JiraDataCenterTokensController from '@/actions/App/Http/Controllers/Integrations/JiraDataCenterTokensController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { IntegrationAccess, IntegrationScope } from '@/types';

type Props = {
    scope: IntegrationScope;
    label: string;
    variant?: 'default' | 'outline' | 'link';
};

/**
 * Spec 8 §4.1: a pasted personal access token acts as its owner, so saving
 * requires ticking "I understand". The token is never shown again.
 */
export function JiraTokenDialog({ scope, label, variant = 'default' }: Props) {
    const { t } = useTrans();
    const tokenId = useId();
    const acknowledgedId = useId();
    const [open, setOpen] = useState(false);
    const [access, setAccess] = useState<IntegrationAccess>('read');
    const [acknowledged, setAcknowledged] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const changeOpen = (next: boolean) => {
        setAccess('read');
        setAcknowledged(false);
        setError(undefined);
        setOpen(next);
    };

    /** A rejection keeps the dialog open: the form dialog closes on success only. */
    const submit = async (data: FormData) => {
        setError(undefined);

        try {
            await retroRequest(JiraDataCenterTokensController.store(scope), {
                token: data.get('token'),
                access,
                acknowledged,
            });
        } catch (caught) {
            if (caught instanceof RetroRequestError && caught.status === 422) {
                setError(
                    caught.errors.token?.[0] ??
                        caught.errors.acknowledged?.[0] ??
                        caught.errors.access?.[0],
                );
                document.getElementById(tokenId)?.focus();
            } else {
                toast.error(
                    integrationErrorMessage(caught, t('Something went wrong.')),
                );
            }

            throw caught;
        }

        toast.success(t('Token saved.'));
        router.reload({ only: ['providers'] });
    };

    return (
        <>
            <Button
                type="button"
                size="sm"
                variant={variant}
                className="max-w-full"
                data-test="integration-connect"
                onClick={() => changeOpen(true)}
            >
                <span className="truncate">{label}</span>
            </Button>
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                title={t('Personal access token')}
                description={t(
                    'Create a token in Jira under Profile → Personal Access Tokens, then paste it here.',
                )}
                submitLabel={t('Save token')}
                submitDisabled={!acknowledged}
                onSubmit={submit}
            >
                <TextField
                    id={tokenId}
                    name="token"
                    type="password"
                    label={t('Personal access token')}
                    required
                    minLength={20}
                    maxLength={255}
                    autoComplete="off"
                    error={error}
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span aria-hidden="true" className="text-sm font-medium">
                        {t('Access')}
                    </span>
                    <ToggleGroup
                        type="single"
                        variant="segmented"
                        fullWidth
                        aria-label={t('Access')}
                        value={access}
                        onValueChange={setAccess}
                        options={[
                            { value: 'read', label: t('Read only') },
                            { value: 'write', label: t('Read and write') },
                        ]}
                    />
                </div>
                <Alert variant="warning" role="note">
                    <TriangleAlert aria-hidden="true" />
                    <AlertDescription>
                        {t(
                            'This token acts as its owner in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by them, and skrum sees only what they can see. Prefer OAuth when your Jira supports it.',
                        )}
                    </AlertDescription>
                </Alert>
                <label
                    htmlFor={acknowledgedId}
                    className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"
                >
                    <Checkbox
                        id={acknowledgedId}
                        checked={acknowledged}
                        onCheckedChange={(checked) =>
                            setAcknowledged(checked === true)
                        }
                    />
                    {t('I understand')}
                </label>
            </FormDialog>
        </>
    );
}
