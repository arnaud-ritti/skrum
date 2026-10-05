import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { authLinkClass } from '@/components/auth/auth-link';
import { BrandAside } from '@/components/auth/brand-aside';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

type Props = { email: string | null; confirmUrl: string | null };

export default function MagicLink({ email, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);
    const usable = email !== null && confirmUrl !== null;
    const title = usable ? t('Sign in') : t('This link no longer works');

    return (
        <AuthLayout
            title={title}
            literalTitle
            description={
                usable
                    ? t('You are about to sign in as :email.', { email })
                    : t(
                          'It has expired or was already used. Request a new one from the log in page.',
                      )
            }
            aside={<BrandAside />}
        >
            <Head title={title} />

            <div
                data-slot="magic-link-confirmation"
                className="flex min-w-0 flex-col gap-4 text-center"
            >
                {usable && (
                    <LoadingButton
                        type="button"
                        size="lg"
                        className="w-full"
                        autoFocus
                        loading={processing}
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
                        <span className="truncate">{t('Continue')}</span>
                    </LoadingButton>
                )}
                <Link href={login()} className={`${authLinkClass} text-sm`}>
                    {t('Back to log in')}
                </Link>
            </div>
        </AuthLayout>
    );
}
