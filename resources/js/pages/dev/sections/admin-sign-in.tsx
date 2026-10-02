import { useState } from 'react';
import type { ReactNode } from 'react';
import { SignInSettingsCard } from '@/components/admin/sign-in-settings-form';
import type { SignInSettingsState } from '@/components/admin/sign-in-settings-form';
import type { BenchGroup } from '@/components/dev/bench';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const providers = [
    { key: 'oidc', label: 'Nordlys SSO' },
    { key: 'google', label: 'Google' },
];

const off: SignInSettingsState = {
    ssoRequired: false,
    inForce: false,
    providers,
    blockers: [],
    accountsWithoutSso: 3,
    adminsWithPasswordWayBack: 2,
};

const blocked: SignInSettingsState = {
    ...off,
    providers: [providers[1]],
    blockers: ['no_identity', 'no_second_factor'],
    accountsWithoutSso: 1,
    adminsWithPasswordWayBack: 0,
};

const inForce: SignInSettingsState = {
    ...off,
    ssoRequired: true,
    inForce: true,
    accountsWithoutSso: 0,
    adminsWithPasswordWayBack: 1,
};

const ignored: SignInSettingsState = {
    ...inForce,
    inForce: false,
    providers: [],
    blockers: ['no_provider'],
};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function CardExample({
    state,
    error,
}: {
    state: SignInSettingsState;
    error?: string;
}) {
    const [required, setRequired] = useState(state.ssoRequired);

    return (
        <SignInSettingsCard
            {...state}
            required={required}
            onRequiredChange={setRequired}
            error={error}
        />
    );
}

export default function AdminSignInSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Single sign-on is off')}>
                <CardExample state={off} />
            </Example>
            <Example label={t('Blocked: nothing lets this admin require it')}>
                <CardExample state={blocked} />
            </Example>
            <Example label={t('Required and in force')}>
                <CardExample state={inForce} />
            </Example>
            <Example label={t('Stored but not in force')}>
                <CardExample state={ignored} />
            </Example>
            <Example label={t('Narrow container')}>
                <div className="max-w-80">
                    <CardExample
                        state={blocked}
                        error={t('Something went wrong. Please try again.')}
                    />
                </div>
            </Example>
        </div>
    );
}
