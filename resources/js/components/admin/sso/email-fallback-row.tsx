import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';

/**
 * The mockup's "Keep sign-in by email as fallback", drawn on and locked:
 * instance admins can always sign in with their password, so there is
 * nothing to choose and nothing to save.
 */
export function EmailFallbackRow() {
    const { t } = useTrans();
    const id = useId();
    const switchId = `${id}-switch`;
    const helpId = `${id}-help`;
    const reasonId = `${id}-reason`;

    return (
        <div
            data-slot="email-fallback-row"
            className="flex min-w-0 items-center justify-between gap-4"
        >
            <div className="flex min-w-0 flex-col gap-0.5">
                <label htmlFor={switchId} className="text-sm font-semibold">
                    {t('Keep sign-in by email as fallback')}
                </label>
                <p id={helpId} className="text-body-sm text-muted-foreground">
                    {t('For the admin if the provider is unavailable.')}
                </p>
                <p id={reasonId} className="text-body-sm text-muted-foreground">
                    {t(
                        'Instance admins can always sign in with their password.',
                    )}
                </p>
            </div>
            <Switch
                id={switchId}
                checked
                disabled
                aria-describedby={`${helpId} ${reasonId}`}
            />
        </div>
    );
}
