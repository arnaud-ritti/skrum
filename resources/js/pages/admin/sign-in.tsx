import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    ssoRequired: boolean;
    inForce: boolean;
    providers: { key: string; label: string }[];
    blockers: string[];
    accountsWithoutSso: number;
    adminsWithPasswordWayBack: number;
};

export default function SignInSettings({ ssoRequired }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Sign-in')} />
            <h1>{t('Sign-in')}</h1>
            <p>
                {ssoRequired
                    ? t('Single sign-on is required.')
                    : t('Single sign-on is optional.')}
            </p>
        </>
    );
}
