import { Head, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function RecapUnsubscribe({ unsubscribed, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);

    setLayoutProps({
        title: t('Recap e-mails'),
        description: unsubscribed
            ? t(
                  'You no longer receive the results of retrospectives by e-mail.',
              )
            : t('Stop the results of retrospectives sent by e-mail?'),
    });

    return (
        <>
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
                <TextLink href={login()}>{t('Log in')}</TextLink>
            </div>
        </>
    );
}
