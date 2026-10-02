import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { BrandAside } from '@/components/auth/brand-aside';
import { authLinkClass } from '@/components/auth/auth-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function RecapUnsubscribe({ unsubscribed, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);

    return (
        <AuthLayout
            title={t('Recap e-mails')}
            literalTitle
            description={
                unsubscribed
                    ? t(
                          'You no longer receive the results of retrospectives by e-mail.',
                      )
                    : t('Stop the results of retrospectives sent by e-mail?')
            }
            aside={<BrandAside />}
        >
            <Head title={t('Recap e-mails')} />

            <div className="flex flex-col gap-4 text-center">
                {!unsubscribed && (
                    <Button
                        type="button"
                        className="w-full"
                        disabled={processing}
                        data-test="unsubscribe-button"
                        onClick={() =>
                            router.post(
                                confirmUrl,
                                {},
                                {
                                    onStart: () => setProcessing(true),
                                    onFinish: () => setProcessing(false),
                                },
                            )
                        }
                    >
                        {processing && <Spinner />}
                        {t('Unsubscribe')}
                    </Button>
                )}
                <Link href={login()} className={authLinkClass}>
                    {t('Log in')}
                </Link>
            </div>
        </AuthLayout>
    );
}
