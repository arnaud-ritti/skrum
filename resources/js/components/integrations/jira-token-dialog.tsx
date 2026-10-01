import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import JiraDataCenterTokensController from '@/actions/App/Http/Controllers/Integrations/JiraDataCenterTokensController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
    const [busy, setBusy] = useState(false);
    const [token, setToken] = useState('');
    const [access, setAccess] = useState<IntegrationAccess>('read');
    const [acknowledged, setAcknowledged] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const changeOpen = (next: boolean) => {
        setToken('');
        setAccess('read');
        setAcknowledged(false);
        setError(undefined);
        setOpen(next);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(undefined);

        try {
            await retroRequest(JiraDataCenterTokensController.store(scope), {
                token,
                access,
                acknowledged,
            });
            changeOpen(false);
            toast.success(t('Token saved.'));
            router.reload({ only: ['providers'] });
        } catch (caught) {
            if (caught instanceof RetroRequestError && caught.status === 422) {
                setError(
                    caught.errors.token?.[0] ??
                        caught.errors.acknowledged?.[0] ??
                        caught.errors.access?.[0],
                );
            } else {
                toast.error(
                    integrationErrorMessage(caught, t('Something went wrong.')),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button
                size="sm"
                variant={variant}
                onClick={() => changeOpen(true)}
            >
                {label}
            </Button>
            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogContent>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => void submit(event)}
                    >
                        <DialogTitle>{t('Personal access token')}</DialogTitle>
                        <DialogDescription>
                            {t(
                                'Create a token in Jira under Profile → Personal Access Tokens, then paste it here.',
                            )}
                        </DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={tokenId}>
                                {t('Personal access token')}
                            </Label>
                            <Input
                                id={tokenId}
                                type="password"
                                required
                                minLength={20}
                                maxLength={255}
                                autoComplete="off"
                                value={token}
                                onChange={(event) =>
                                    setToken(event.target.value)
                                }
                            />
                            <InputError message={error} />
                        </div>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={access}
                            onValueChange={(next) => {
                                if (next === 'read' || next === 'write') {
                                    setAccess(next);
                                }
                            }}
                            aria-label={t('Access')}
                        >
                            <ToggleGroupItem value="read">
                                {t('Read only')}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="write">
                                {t('Read and write')}
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <p
                            role="note"
                            className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                        >
                            {t(
                                'This token acts as its owner in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by them, and skrum sees only what they can see. Prefer OAuth when your Jira supports it.',
                            )}
                        </p>
                        <label
                            htmlFor={acknowledgedId}
                            className="flex items-center gap-2 text-sm"
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
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => changeOpen(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={busy || !acknowledged}
                            >
                                {busy && <Spinner />}
                                {t('Save token')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
