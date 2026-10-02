import { Head, Link } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import { AccessNotice } from '@/components/auth/access-notice';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';
import { login } from '@/routes';

export default function SessionEnded() {
    const { t } = useTrans();

    return (
        <AuthLayout variant="centered" title="Your session has ended.">
            <Head title={t('Your session has ended.')} />
            <AccessNotice
                icon={LogOut}
                title={t('Your session has ended.')}
                hint={t('Guests: ask the facilitator for the guest link.')}
                action={
                    <Button className="w-full" asChild>
                        <Link href={login()}>{t('Log in')}</Link>
                    </Button>
                }
            />
        </AuthLayout>
    );
}
