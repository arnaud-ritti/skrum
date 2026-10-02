import { Link, usePage } from '@inertiajs/react';
import SignInSettingsController from '@/actions/App/Http/Controllers/Admin/SignInSettingsController';
import { authLinkClass } from '@/components/auth/auth-link';
import { Alert } from '@/components/ui/alert';
import { useTrans } from '@/hooks/use-trans';

/**
 * Tells instance admins that required single sign-on is ignored because no
 * provider is enabled. The server sends `signInAlert` to them only.
 */
export function SignInAlert() {
    const { t } = useTrans();
    const { signInAlert } = usePage().props;

    if (signInAlert !== 'sso_required_ignored') {
        return null;
    }

    return (
        <Alert
            variant="warning"
            role="alert"
            data-slot="sign-in-alert"
            className="mb-6"
            title={t(
                'Single sign-on is required on this instance, but no provider is configured: the setting is ignored and every sign-in method works.',
            )}
            action={
                <Link
                    href={SignInSettingsController.edit()}
                    className={`${authLinkClass} text-sm text-current`}
                >
                    {t('Sign-in settings')}
                </Link>
            }
        />
    );
}
