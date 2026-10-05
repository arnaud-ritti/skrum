import { ArrowRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import OnboardingWorkspacesController from '@/actions/App/Http/Controllers/OnboardingWorkspacesController';
import {
    StepActions,
    StepFieldError,
    StepHeading,
} from '@/components/onboarding/step-layout';
import { useStepRequest } from '@/components/onboarding/use-step-request';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';

export const MaxWorkspaceNameLength = 100;

export type LocaleOption = { value: string; label: string };

/**
 * Step 1, "Name your workspace": its name and default language. The logo's
 * place is left empty (no workspace logo yet).
 */
export function WorkspaceStep({
    workspace,
    locales,
    userLocale,
    name,
    onNameChange,
}: {
    workspace: { name: string; locale: string | null } | null;
    locales: LocaleOption[];
    userLocale: string;
    name: string;
    onNameChange: (name: string) => void;
}) {
    const { t } = useTrans();
    const fieldId = useId();
    const { busy, errors, send } = useStepRequest<'continue'>();
    const preferred = workspace?.locale ?? userLocale;
    const [locale, setLocale] = useState(
        locales.some((option) => option.value === preferred)
            ? preferred
            : (locales[0]?.value ?? preferred),
    );

    const submit = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        send('continue', 'put', OnboardingWorkspacesController.update.url(), {
            name,
            locale,
        });
    };

    return (
        <form
            data-slot="workspace-step"
            noValidate
            onSubmit={submit}
            className="flex min-w-0 flex-col gap-5"
        >
            <StepHeading
                number={1}
                title={t('Name your workspace')}
                lead={t(
                    'The workspace groups your teams, templates and members.',
                )}
            />
            <TextField
                id={`${fieldId}-name`}
                label={t('Workspace name')}
                value={name}
                maxLength={MaxWorkspaceNameLength}
                autoFocus
                autoComplete="organization"
                required
                disabled={busy}
                error={errors.name}
                onChange={(event) => onNameChange(event.target.value)}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-locale`}>
                    {t('Default language')}
                </Label>
                <Select
                    value={locale}
                    onValueChange={setLocale}
                    disabled={busy}
                >
                    <SelectTrigger
                        id={`${fieldId}-locale`}
                        aria-invalid={
                            errors.locale === undefined ? undefined : true
                        }
                        aria-describedby={
                            errors.locale === undefined
                                ? undefined
                                : `${fieldId}-locale-error`
                        }
                        className="w-full"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {locales.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <StepFieldError
                    id={`${fieldId}-locale-error`}
                    message={errors.locale}
                />
            </div>
            <StepActions className="justify-end">
                <LoadingButton type="submit" size="lg" loading={busy}>
                    {t('Continue')}
                    {!busy && <ArrowRight aria-hidden="true" />}
                </LoadingButton>
            </StepActions>
        </form>
    );
}
