import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import MotionPreferencesController from '@/actions/App/Http/Controllers/Settings/MotionPreferencesController';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { applyReduceMotion, systemPrefersReducedMotion } from '@/lib/motion';

type ReduceMotionFieldProps = {
    /** The stored preference of the account. */
    enabled: boolean;
};

const controlId = 'reduce-motion';
const helpId = `${controlId}-help`;

/** "Reduce animations" of the Appearance card, saved as soon as it is switched. */
export function ReduceMotionField({
    enabled,
}: ReduceMotionFieldProps): ReactElement {
    const { t } = useTrans();
    const [reduceMotion, setReduceMotion] = useState(enabled);
    const [systemAsks] = useState(systemPrefersReducedMotion);

    const save = (reduce_motion: boolean): void => {
        const previous = reduceMotion;

        setReduceMotion(reduce_motion);
        router.patch(
            MotionPreferencesController.update.url(),
            { reduce_motion },
            {
                preserveScroll: true,
                onSuccess: () => applyReduceMotion(reduce_motion),
                onError: () => setReduceMotion(previous),
            },
        );
    };

    return (
        <div
            data-slot="reduce-motion-field"
            className="flex min-w-0 items-center justify-between gap-4"
        >
            <div className="flex min-w-0 flex-1 flex-col">
                <Label htmlFor={controlId}>{t('Reduce animations')}</Label>
                <span id={helpId} className="text-xs text-muted-foreground">
                    {t(
                        'Replaces card flips, confetti and drag tilts with simple fades. On by default when your system asks for it.',
                    )}
                </span>
                {systemAsks && (
                    <span className="text-xs text-muted-foreground">
                        {t('Your system already asks for fewer animations.')}
                    </span>
                )}
            </div>
            <Switch
                id={controlId}
                aria-describedby={helpId}
                checked={reduceMotion}
                onCheckedChange={save}
            />
        </div>
    );
}
