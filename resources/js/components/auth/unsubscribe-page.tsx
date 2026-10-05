import { Head, Link, useForm } from '@inertiajs/react';
import { authLinkClass } from '@/components/auth/auth-link';
import { BrandAside } from '@/components/auth/brand-aside';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

type Props = {
    title: string;
    doneText: string;
    askText: string;
    unsubscribed: boolean;
    confirmUrl: string;
};

/** One-click unsubscribe from an email, reached from a signed link. */
export function UnsubscribePage({
    title,
    doneText,
    askText,
    unsubscribed,
    confirmUrl,
}: Props) {
    const { t } = useTrans();
    const { post, processing } = useForm({});

    return (
        <AuthLayout
            title={title}
            description={unsubscribed ? doneText : askText}
            aside={<BrandAside />}
        >
            <Head title={title} />

            <div className="flex flex-col gap-4 text-center">
                {!unsubscribed && (
                    <Button
                        type="button"
                        className="w-full"
                        disabled={processing}
                        data-test="unsubscribe-button"
                        onClick={() => post(confirmUrl)}
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
