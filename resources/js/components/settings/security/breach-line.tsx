import { Check, Circle, Loader2, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { PasswordBreachCheck } from '@/components/settings/security/password-strength';
import type { BreachState } from '@/components/settings/security/use-breach-check';
import { useTrans } from '@/hooks/use-trans';

/** The new password field points at the line while it says the password is breached. */
export const BreachLineId = 'password-breach-line';

/**
 * The breach rule of the password rules, checked while typing. Where the
 * instance cannot check live, the line falls back to the check at save.
 */
export function BreachLine({
    state,
    liveBreachCheck,
    checksCompromisedPasswords,
}: {
    state: BreachState;
    liveBreachCheck: boolean;
    checksCompromisedPasswords: boolean;
}): ReactElement | null {
    const { t } = useTrans();

    if (!checksCompromisedPasswords) {
        return null;
    }

    if (!liveBreachCheck || state === 'unavailable') {
        return <PasswordBreachCheck />;
    }

    const shared = {
        'data-slot': 'password-breach-line',
        'data-state': state,
        className: 'inline-flex items-center gap-1.5',
    };

    if (state === 'checking') {
        return (
            <li {...shared}>
                <Loader2
                    aria-hidden="true"
                    data-slot="breach-spinner"
                    className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                />
                <span>{t('Checking known data breaches…')}</span>
            </li>
        );
    }

    if (state === 'breached') {
        return (
            <li
                {...shared}
                id={BreachLineId}
                data-met="false"
                className="inline-flex items-center gap-1.5 text-skrum-destructive-text"
            >
                <X aria-hidden="true" className="size-4 shrink-0" />
                <span>
                    {t('Found in known data breaches: choose another one')}
                </span>
            </li>
        );
    }

    if (state === 'clear') {
        return (
            <li {...shared} data-met="true">
                <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-skrum-success-text"
                />
                <span>{t('Not found in known data breaches')}</span>
                <span className="sr-only">{t('(met)')}</span>
            </li>
        );
    }

    return (
        <li {...shared}>
            <Circle aria-hidden="true" className="size-4 shrink-0" />
            <span>{t('Not found in known data breaches')}</span>
        </li>
    );
}
