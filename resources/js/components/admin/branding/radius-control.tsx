import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { clampRadius, MaxRadius, MinRadius } from './branding';

export type RadiusControlProps = {
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
    const exactId = `${id}-exact`;
    const errorId = `${id}-error`;

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
                    aria-label={t('Corner radius')}
                    value={String(value)}
                    onValueChange={(next) =>
                        onChange(clampRadius(Number(next)))
                    }
                    options={[
                        { value: '0', label: `${t('Square')} 0` },
                        { value: '6', label: `${t('Soft')} 6` },
                        { value: '10', label: `${t('Standard')} 10` },
                        { value: '16', label: `${t('Round')} 16` },
                    ]}
                    className="min-w-0 flex-1 basis-64 [&>*]:flex-auto"
                />
                <div className="flex shrink-0 items-center gap-1.5">
                    <Label htmlFor={exactId} className="sr-only">
                        {t('Exact radius in pixels')}
                    </Label>
                    <Input
                        id={exactId}
                        type="number"
                        inputMode="numeric"
                        min={MinRadius}
                        max={MaxRadius}
                        step={1}
                        value={value}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        onChange={(event) =>
                            onChange(clampRadius(Number(event.target.value)))
                        }
                        className="w-16 tabular-nums"
                    />
                    <span
                        aria-hidden="true"
                        className="text-body-sm text-muted-foreground"
                    >
                        px
                    </span>
                </div>
            </div>
            {error ? (
                <span
                    id={errorId}
                    data-slot="field-error"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {error}
                </span>
            ) : (
                <span className="text-body-sm text-muted-foreground">
                    {t(
                        'From 0 to 16 pixels. Cards and columns keep their shape.',
                    )}
                </span>
            )}
        </div>
    );
}
