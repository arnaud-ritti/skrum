import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { nearestRadiusPreset } from './branding';

export type RadiusControlProps = {
    /** Stored radius, 0 to 16: the nearest segment is shown selected. */
    value: number;
    onChange: (value: number) => void;
    error?: string;
    className?: string;
};

export function RadiusControl({
    value,
    onChange,
    error,
    className,
}: RadiusControlProps) {
    const { t } = useTrans();
    const id = useId();

    return (
        <div
            data-slot="radius-control"
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label id={id}>{t('Corner radius')}</Label>
            <ToggleGroup
                type="single"
                variant="segmented"
                fullWidth
                aria-label={t('Corner radius')}
                value={String(nearestRadiusPreset(value))}
                onValueChange={(next) => onChange(Number(next))}
                options={[
                    { value: '0', label: t('Square') },
                    { value: '4', label: t('Soft') },
                    { value: '8', label: t('Standard') },
                    { value: '16', label: t('Round') },
                ]}
            />
            {error && (
                <span
                    data-slot="field-error"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {error}
                </span>
            )}
        </div>
    );
}
