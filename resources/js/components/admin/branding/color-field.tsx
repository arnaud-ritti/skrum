import { useId } from 'react';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { normalizeHex } from './branding';
import type { Palette, ThemeName } from './branding';
import { ContrastBadge } from './contrast-badge';
import { PaletteWarnings } from './palette-warnings';

function Swatch({
    slot,
    label,
    hex,
    ratio,
}: {
    slot: string;
    label: string;
    hex: string | null;
    ratio?: number;
}) {
    const { t } = useTrans();

    return (
        <div
            data-slot={slot}
            className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2"
        >
            <span
                aria-hidden="true"
                className="size-9 shrink-0 rounded-md border"
                style={hex === null ? undefined : { backgroundColor: hex }}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs text-muted-foreground">
                    {label}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <code className="truncate text-body-sm font-semibold">
                        {hex ?? t('Not a colour')}
                    </code>
                    {ratio !== undefined && <ContrastBadge ratio={ratio} />}
                </span>
            </span>
        </div>
    );
}

export type ColorFieldProps = {
    value: string;
    onChange: (value: string) => void;
    defaultColor: string;
    palette: Palette | null;
    loading?: boolean;
    error?: string;
    className?: string;
};

const Themes: ThemeName[] = ['light', 'dark'];

export function ColorField({
    value,
    onChange,
    defaultColor,
    palette,
    loading = false,
    error,
    className,
}: ColorFieldProps) {
    const { t } = useTrans();
    const pickerId = useId();
    const entered = normalizeHex(value);
    const usesDefault = value.trim() === '';
    const appliedLabels: Record<ThemeName, string> = {
        light: t('Applied, light theme'),
        dark: t('Applied, dark theme'),
    };

    return (
        <div
            data-slot="color-field"
            className={cn('flex min-w-0 flex-col gap-3', className)}
        >
            <div className="flex min-w-0 items-start gap-2">
                <TextField
                    label={t('Primary colour')}
                    description={t(
                        'Any hex colour. Skrüm derives the shades and keeps text readable.',
                    )}
                    error={error}
                    value={value}
                    placeholder={defaultColor}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={(event) => onChange(event.target.value.trim())}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    wrapperClassName="flex-1"
                />
                <label
                    htmlFor={pickerId}
                    className="mt-5 flex shrink-0 cursor-pointer"
                >
                    <span className="sr-only">{t('Pick a colour')}</span>
                    <input
                        id={pickerId}
                        type="color"
                        data-slot="color-picker"
                        value={entered ?? normalizeHex(defaultColor) ?? ''}
                        onChange={(event) => onChange(event.target.value)}
                        className="size-9 cursor-pointer rounded-md border border-input bg-card p-1 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </label>
            </div>
            <div
                aria-busy={loading}
                className={cn(
                    'grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(44)),1fr))] gap-2 transition-opacity duration-140 ease-standard motion-reduce:transition-none',
                    loading && 'opacity-60',
                )}
            >
                <Swatch
                    slot="color-entered"
                    label={usesDefault ? t('Skrüm default') : t('Entered')}
                    hex={usesDefault ? defaultColor : entered}
                />
                {palette !== null &&
                    Themes.map((theme) => (
                        <Swatch
                            key={theme}
                            slot={`color-applied-${theme}`}
                            label={appliedLabels[theme]}
                            hex={palette[theme].primary}
                            ratio={palette.ratios[theme].onPrimary}
                        />
                    ))}
            </div>
            {palette !== null && (
                <PaletteWarnings warnings={palette.warnings} />
            )}
        </div>
    );
}
