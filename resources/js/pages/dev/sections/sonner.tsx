import { CircleAlert, EyeOff, Undo2, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { BenchGroup } from '@/components/dev/bench';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

const connectionToastId = 'ws';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex flex-wrap items-start gap-2">{children}</div>
        </div>
    );
}

export default function SonnerSection() {
    const { t } = useTrans();

    const showReconnected = (): void => {
        toast.success(t('Reconnected'), {
            id: connectionToastId,
            description: undefined,
            duration: 5000,
            icon: undefined,
            cancel: undefined,
        });
    };

    const showConnectionLost = (): void => {
        toast.warning(t('Connection lost'), {
            id: connectionToastId,
            description: t('Reconnecting in :seconds s', { seconds: 4 }),
            duration: Infinity,
            icon: <WifiOff aria-hidden="true" className="size-4" />,
            cancel: {
                label: t('Now'),
                onClick: showReconnected,
            },
        });
    };

    return (
        <div className="flex max-w-240 flex-col gap-6 p-6">
            <State label={t('Toast: success (enters, closes after 5 s)')}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        toast.success(t('Retro created'), {
                            description: t('The invitation link is copied.'),
                        })
                    }
                >
                    {t('Show success toast')}
                </Button>
            </State>
            <State label={t('Toast: info with an undo action')}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        toast.info(t(':count cards merged', { count: 3 }), {
                            description: t('Group “Flaky tests”.'),
                            action: {
                                label: (
                                    <>
                                        <Undo2
                                            aria-hidden="true"
                                            className="mr-1.5 size-4"
                                        />
                                        {t('Undo')}
                                    </>
                                ),
                                onClick: () => toast(t('Merge undone')),
                            },
                        })
                    }
                >
                    {t('Show info toast')}
                </Button>
            </State>
            <State
                label={t(
                    'Toast: persistent warning, same id updated to success',
                )}
            >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={showConnectionLost}
                >
                    {t('Lose connection')}
                </Button>
                <Button variant="outline" size="sm" onClick={showReconnected}>
                    {t('Reconnect')}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.dismiss(connectionToastId)}
                >
                    {t('Close it')}
                </Button>
            </State>
            <State label={t('Toast: error with a retry action')}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        toast.error(t('Jira export failed'), {
                            description: t(
                                'Token expired — reconnect the integration.',
                            ),
                            action: {
                                label: t('Retry'),
                                onClick: () => toast.success(t('Export sent')),
                            },
                        })
                    }
                >
                    {t('Show error toast')}
                </Button>
            </State>
            <State label={t('Toast: plain message and close button')}>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast(t('Link copied'))}
                >
                    {t('Show plain toast')}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        toast.success(t('Action assigned to Malik'), {
                            closeButton: true,
                        })
                    }
                >
                    {t('Show toast with close button')}
                </Button>
            </State>
            <State
                label={t('Toast: stack of three (collapsed, expands on hover)')}
            >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        toast.success(t('Card added'));
                        toast.success(t('Vote recorded'));
                        toast.success(t('Action assigned to Malik'));
                    }}
                >
                    {t('Show three toasts')}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.dismiss()}
                >
                    {t('Close all toasts')}
                </Button>
            </State>
            <State label={t('Alert: info')}>
                <Alert
                    variant="info"
                    title={t('Cards are hidden while writing')}
                    description={t(
                        'The facilitator reveals them to everyone at the same time.',
                    )}
                />
            </State>
            <State label={t('Alert: success')}>
                <Alert
                    variant="success"
                    title={t('SMTP configured')}
                    description={t('A test email was sent to :email.', {
                        email: 'admin@atlas.io',
                    })}
                />
            </State>
            <State label={t('Alert: warning with an action')}>
                <Alert
                    variant="warning"
                    title={t(
                        ':count actions from sprint :sprint are not done',
                        {
                            count: 2,
                            sprint: 41,
                        },
                    )}
                    description={t(
                        'Pick them up at the start of the retro or postpone them.',
                    )}
                    action={
                        <Button variant="outline" size="sm">
                            {t('View')}
                        </Button>
                    }
                />
            </State>
            <State label={t('Alert: error')}>
                <Alert
                    variant="error"
                    title={t('SSO certificate expired')}
                    description={t(
                        'Members can no longer sign in through Okta. Update the certificate.',
                    )}
                />
            </State>
            <State label={t('Alert: title only, custom icon')}>
                <Alert
                    variant="info"
                    icon={EyeOff}
                    title={t('Cards are hidden while writing')}
                />
            </State>
            <State label={t('Alert: narrow container, the action wraps')}>
                <div className="w-80">
                    <Alert
                        variant="error"
                        title={t('SSO certificate expired')}
                        description={t(
                            'Members can no longer sign in through Okta. Update the certificate.',
                        )}
                        action={
                            <Button variant="outline" size="sm">
                                {t('Update')}
                            </Button>
                        }
                    />
                </div>
            </State>
            <State
                label={t('Alert: existing default and destructive variants')}
            >
                <Alert>
                    <CircleAlert />
                    <AlertTitle>{t('Heads up')}</AlertTitle>
                    <AlertDescription>
                        {t('This alert uses the composed parts.')}
                    </AlertDescription>
                </Alert>
                <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>{t('Something went wrong.')}</AlertTitle>
                    <AlertDescription>
                        {t('This alert uses the composed parts.')}
                    </AlertDescription>
                </Alert>
            </State>
        </div>
    );
}
