import { router } from '@inertiajs/react';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import SignInSettingsController from '@/actions/App/Http/Controllers/Admin/SignInSettingsController';
import { UnsavedBar } from '@/components/admin/branding/unsaved-bar';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';

export type SignInBlocker = 'no_provider' | 'no_identity' | 'no_second_factor';

export type SignInSettingsState = {
    /** The stored setting. */
    ssoRequired: boolean;
    /** False while the setting is stored and no provider is enabled. */
    inForce: boolean;
    providers: { key: string; label: string }[];
    /** What keeps this admin from requiring single sign-on. */
    blockers: string[];
    accountsWithoutSso: number;
    adminsWithPasswordWayBack: number;
};

export type SignInSettingsFormProps = SignInSettingsState & {
    /**
     * Places the unsaved-changes bar and the card: the page hands the bar to
     * the topbar. Without it the bar sits above the card.
     */
    frame?: (bar: ReactNode, content: ReactNode) => ReactNode;
};

function stacked(bar: ReactNode, content: ReactNode): ReactNode {
    return (
        <>
            <div className="flex justify-end">{bar}</div>
            {content}
        </>
    );
}

export type SignInSettingsCardProps = SignInSettingsState & {
    /** The switch as it stands on the page, saved or not. */
    required: boolean;
    onRequiredChange: (required: boolean) => void;
    saving?: boolean;
    /** Refusal of the server, shown under the switch. */
    error?: string;
};

/** The card alone: what it shows comes from its props, and it sends nothing. */
export function SignInSettingsCard({
    ssoRequired,
    inForce,
    providers,
    blockers,
    accountsWithoutSso,
    adminsWithPasswordWayBack,
    required,
    onRequiredChange,
    saving = false,
    error,
}: SignInSettingsCardProps) {
    const { t } = useTrans();
    const errorId = useId();
    const isBlocked = !ssoRequired && blockers.length > 0;
    const blockerSentences: Record<SignInBlocker, string> = {
        no_provider: t(
            'Configure a single sign-on provider before requiring it.',
        ),
        no_identity: t(
            'Sign in once with single sign-on yourself before requiring it for everyone.',
        ),
        no_second_factor: t(
            'Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.',
        ),
    };
    const pluralAccounts = t(
        ':count accounts have never signed in with single sign-on. Each is linked on its first single sign-on if its address matches; otherwise it cannot sign in.',
        { count: accountsWithoutSso },
    );
    const accountsSentence =
        accountsWithoutSso === 1
            ? t(
                  '1 account has never signed in with single sign-on. It is linked on its first single sign-on if its address matches; otherwise it cannot sign in.',
              )
            : pluralAccounts;
    const pluralAdmins = t(
        ':count administrators can sign in with a password and a second factor if single sign-on fails.',
        { count: adminsWithPasswordWayBack },
    );
    const adminsSentence =
        adminsWithPasswordWayBack === 1
            ? t(
                  '1 administrator can sign in with a password and a second factor if single sign-on fails.',
              )
            : pluralAdmins;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('Single sign-on')}</CardTitle>
                {providers.length === 0 && (
                    <CardDescription>
                        {t('No single sign-on provider is configured.')}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-4">
                {providers.length > 0 && (
                    <ul
                        role="list"
                        aria-label={t('Single sign-on providers')}
                        className="flex min-w-0 flex-wrap gap-2"
                    >
                        {providers.map((provider) => (
                            <li
                                key={provider.key}
                                className="max-w-full truncate rounded-md border bg-muted px-3 py-1.5 text-sm font-medium"
                            >
                                {provider.label}
                            </li>
                        ))}
                    </ul>
                )}

                {ssoRequired && !inForce && (
                    <p
                        role="status"
                        data-slot="sign-in-not-in-force"
                        className="flex min-w-0 items-start gap-2 rounded-lg bg-skrum-info-soft px-4 py-3 text-sm text-skrum-info-text"
                    >
                        <Info
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0">
                            {t(
                                'The setting is stored but not in force: no single sign-on provider is configured.',
                            )}
                        </span>
                    </p>
                )}

                <div className="flex min-w-0 flex-col gap-2">
                    <Switch
                        id="sso-required"
                        checked={required}
                        disabled={isBlocked || saving}
                        onCheckedChange={onRequiredChange}
                        aria-invalid={error ? true : undefined}
                        aria-errormessage={error ? errorId : undefined}
                        label={
                            <span className="font-medium">
                                {t('Require single sign-on')}
                            </span>
                        }
                        description={t(
                            'Password, magic link, passkey and registration by form are refused. Only administrators can still sign in with their password, followed by their second factor.',
                        )}
                    />
                    {error && (
                        <p
                            id={errorId}
                            role="alert"
                            data-slot="field-error"
                            className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                        >
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0"
                            />
                            <span className="min-w-0">{error}</span>
                        </p>
                    )}
                    {isBlocked && (
                        <ul
                            data-slot="sign-in-blockers"
                            className="flex min-w-0 flex-col gap-1 text-body-sm text-muted-foreground"
                        >
                            {blockers.map((blocker) => (
                                <li key={blocker}>
                                    {blockerSentences[
                                        blocker as SignInBlocker
                                    ] ?? blocker}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {accountsWithoutSso > 0 && (
                    <p
                        data-slot="sign-in-accounts-warning"
                        className="flex min-w-0 items-start gap-2 rounded-lg bg-skrum-warning-soft px-4 py-3 text-sm text-skrum-warning-text"
                    >
                        <TriangleAlert
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0">{accountsSentence}</span>
                    </p>
                )}

                {adminsWithPasswordWayBack === 0 ? (
                    <p
                        role="alert"
                        data-slot="sign-in-no-way-back"
                        className="flex min-w-0 items-start gap-2 rounded-lg bg-skrum-destructive-soft px-4 py-3 text-sm text-skrum-destructive-text"
                    >
                        <CircleAlert
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0">
                            {t(
                                'No administrator has a second factor: nobody can sign in with a password if single sign-on fails.',
                            )}
                        </span>
                    </p>
                ) : (
                    <p
                        data-slot="sign-in-way-back"
                        className="text-body-sm text-muted-foreground"
                    >
                        {adminsSentence}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export function SignInSettingsForm({
    frame = stacked,
    ...state
}: SignInSettingsFormProps) {
    const { t } = useTrans();
    const formId = useId();
    const { ssoRequired } = state;
    const [required, setRequired] = useState(ssoRequired);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>();

    const cancel = (): void => {
        setRequired(ssoRequired);
        setError(undefined);
    };

    const save = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        router.put(
            SignInSettingsController.update.url(),
            { sso_required: required },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setError(undefined),
                onError: (errors) => setError(errors.sso_required),
            },
        );
    };

    const bar = (
        <UnsavedBar
            count={required === ssoRequired ? 0 : 1}
            saving={saving}
            onCancel={cancel}
            form={formId}
        />
    );

    const content = (
        <form
            id={formId}
            onSubmit={save}
            aria-label={t('SSO authentication')}
            data-slot="sign-in-settings-form"
            className="flex min-w-0 flex-col gap-6"
        >
            <SignInSettingsCard
                {...state}
                required={required}
                onRequiredChange={(checked) => {
                    setRequired(checked);
                    setError(undefined);
                }}
                saving={saving}
                error={error}
            />
        </form>
    );

    return frame(bar, content);
}
