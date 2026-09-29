import { Head, Link } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

export default function SessionEnded() {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Your session has ended.')} />
            <div className="space-y-6">
                <Heading
                    title={t('Your session has ended.')}
                    description={t(
                        'Guests: ask the facilitator for the guest link.',
                    )}
                />
                <Button className="w-full" asChild>
                    <Link href={login()}>{t('Log in')}</Link>
                </Button>
            </div>
        </>
    );
}
