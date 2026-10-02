import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import {
    clampRadius,
    isRadiusPreset,
    MaxRadius,
    MinRadius,
    nearestRadiusPreset,
} from './branding';

export type RadiusControlProps = {
    /** Radius of the form, 0 to 16. */
    value: number;
    onChange: (value: number) => void;
    /**
     * The stored radius is none of the four segments: its exact value shows in
     * a field and no segment is selected until one is chosen. Without it the
     * nearest segment is shown, which is how the default radius reads.
     */
    exact?: boolean;
    error?: string;
    className?: string;
};

function selectedSegment(value: number, exact: boolean): string {
    if (isRadiusPreset(value)) {
        return String(value);
    }

    return exact ? '' : String(nearestRadiusPreset(value));
}

export function RadiusControl({
    value,
    onChange,
    exact = false,
    error,
    className,
}: RadiusControlProps) {
    const { t } = useTrans();
    const id = useId();
    const [typed, setTyped] = useState<string | null>(null);

    function type(text: string): void {
        setTyped(text);

        if (text.trim() === '' || Number.isNaN(Number(text))) {
            return;
        }

        onChange(clampRadius(Number(text)));
    }

    return (
        <div
            data-slot="radius-control"
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label id={id}>{t('Corner radius')}</Label>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    fullWidth
                    aria-label={t('Corner radius')}
                    value={selectedSegment(value, exact)}
                    onValueChange={(next) => {
                        setTyped(null);
                        onChange(Number(next));
                    }}
                    options={[
                        { value: '0', label: t('Square') },
                        { value: '4', label: t('Soft') },
                        { value: '8', label: t('Standard') },
                        { value: '16', label: t('Round') },
                    ]}
                    className="min-w-0 flex-1 basis-60"
                />
                {exact && (
                    <span
                        data-slot="radius-exact"
                        className="relative flex w-24 shrink-0 items-center"
                    >
                        <Input
                            type="number"
                            inputMode="numeric"
                            min={MinRadius}
                            max={MaxRadius}
                            step={1}
                            aria-label={t('Exact radius in pixels')}
                            aria-invalid={error ? true : undefined}
                            value={typed ?? String(value)}
                            onChange={(event) => type(event.target.value)}
                            onBlur={() => setTyped(null)}
                            className="pr-9 font-mono"
                        />
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3 text-xs text-muted-foreground"
                        >
                            px
                        </span>
                    </span>
                )}
            </div>
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
