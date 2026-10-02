import type { UrlMethodPair } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { usePasskeyVerify } from '@laravel/passkeys/react';
import { CircleAlert, KeyRound } from 'lucide-react';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';

export type PasskeyRoutes = {
    options: UrlMethodPair;
    submit: UrlMethodPair;
};

export function PasskeySignIn({
    routes,
    label,
    loadingLabel,
    separator,
}: {
    routes?: PasskeyRoutes;
    label?: string;
    loadingLabel?: string;
    separator?: string;
}) {
    const { t } = useTrans();
    const { verify, isLoading, error, isSupported } = usePasskeyVerify({
        ...(routes && {
            routes: {
                options: routes.options.url,
                submit: routes.submit.url,
            },
        }),
        onSuccess: (response) => {
            router.visit(response.redirect ?? '/dashboard');
        },
    });

    if (!isSupported) {
        return null;
    }

    return (
        <div
            data-slot="passkey-sign-in"
            className="flex min-w-0 flex-col gap-4"
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <LoadingButton
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full"
                    loading={isLoading}
                    onClick={verify}
                >
                    <KeyRound aria-hidden />
                    <span className="truncate">
                        {isLoading
                            ? (loadingLabel ?? t('Authenticating...'))
                            : (label ?? t('Sign in with a passkey'))}
                    </span>
                </LoadingButton>
                {error !== null && (
                    <p
                        role="alert"
                        data-slot="passkey-error"
                        className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
                    >
                        <CircleAlert aria-hidden className="size-4 shrink-0" />
                        {error}
                    </p>
                )}
            </div>
            <AuthSeparator label={separator ?? t('or with your e-mail')} />
        </div>
    );
}
