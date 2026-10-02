import { Head, Link, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import { authLinkClass } from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { email: string | null; confirmUrl: string | null };

export default function MagicLink({ email, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);
    const usable = email !== null && confirmUrl !== null;

    setLayoutProps({
        title: usable ? t('Sign in') : t('This link no longer works'),
        description: usable
            ? t('You are about to sign in as :email.', { email })
            : t(
                  'It has expired or was already used. Request a new one from the log in page.',
              ),
    });

    return (
        <>
            <Head title={t('Sign in')} />

            <div className="flex flex-col gap-4 text-center">
                {usable && (
                    <Button
                        type="button"
                        className="w-full"
                        autoFocus
                        disabled={processing}
                        data-test="magic-link-confirm-button"
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
                        {t('Continue')}
                    </Button>
                )}
                <Link href={login()} className={authLinkClass}>
                    {t('Back to log in')}
                </Link>
            </div>
        </>
    );
}
