import { ArrowRight, Palette as PaletteIcon, WandSparkles } from 'lucide-react';
import { useId } from 'react';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { normalizeHex } from './branding';
import type { Palette } from './branding';
import { ContrastBadge } from './contrast-badge';
import { PaletteWarnings } from './palette-warnings';

function MiniSwatch({ hex }: { hex: string | null }) {
    return (
        <span
            aria-hidden="true"
            data-slot="color-mini"
            title={hex ?? undefined}
            className="size-4.5 shrink-0 rounded-sm border border-current/30"
            style={hex === null ? undefined : { backgroundColor: hex }}
        />
    );
}

type ColorFieldProps = {
    value: string;
    onChange: (value: string) => void;
    defaultColor: string;
    palette: Palette | null;
    loading?: boolean;
    error?: string;
    className?: string;
};

/**
 * The field with the contrast of the applied colour beside it, and under it
 * the notice that shows what was entered, what is applied and why they differ.
 */
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
    const enteredHex = usesDefault ? defaultColor : entered;
    const adjusted = palette !== null && palette.warnings.length > 0;
    const NoticeIcon = adjusted ? WandSparkles : PaletteIcon;

    return (
        <div
            data-slot="color-field"
            className={cn('@container flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex min-w-0 flex-wrap items-start gap-2">
                <div className="flex min-w-0 flex-1 basis-48 items-start gap-2">
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
                    <TextField
                        label={t('Primary colour')}
                        error={error}
                        value={value}
                        placeholder={defaultColor}
                        onChange={(event) => onChange(event.target.value)}
                        onBlur={(event) => onChange(event.target.value.trim())}
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={32}
                        className="font-mono"
                        wrapperClassName="flex-1"
                    />
                </div>
                {palette !== null && (
                    <p
                        data-slot="color-applied-light"
                        aria-busy={loading}
                        className={cn(
                            'flex min-h-9 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground transition-opacity duration-140 ease-standard motion-reduce:transition-none @md:mt-5',
                            loading && 'opacity-60',
                        )}
                    >
                        <ContrastBadge ratio={palette.ratios.light.onPrimary} />
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">
                                {t('Applied, light theme')}
                            </span>
                            <code className="font-semibold text-foreground">
                                {palette.light.primary}
                            </code>
                        </span>
                    </p>
                )}
            </div>
            <div
                data-slot="color-guard"
                data-adjusted={adjusted ? '' : undefined}
                className={cn(
                    'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted px-3 py-2.5 text-body-sm text-muted-foreground transition-opacity duration-140 ease-standard data-[adjusted]:bg-skrum-warning-soft data-[adjusted]:text-skrum-warning-text motion-reduce:transition-none',
                    loading && 'opacity-60',
                )}
            >
                <NoticeIcon aria-hidden="true" className="size-4 shrink-0" />
                <div
                    role="status"
                    aria-busy={loading}
                    className="flex min-w-0 flex-1 basis-48 flex-col gap-1"
                >
                    {palette !== null && (
                        <PaletteWarnings bare warnings={palette.warnings} />
                    )}
                    {palette === null ? (
                        <span>
                            {t(
                                'Any hex colour. Skrüm derives the shades and keeps text readable.',
                            )}
                        </span>
                    ) : (
                        <p
                            data-slot="color-applied-dark"
                            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
                        >
                            <span className="truncate">
                                {t('Applied, dark theme')}
                            </span>
                            <code className="font-semibold">
                                {palette.dark.primary}
                            </code>
                            <ContrastBadge
                                ratio={palette.ratios.dark.onPrimary}
                            />
                        </p>
                    )}
                </div>
                <span className="flex min-w-0 shrink-0 items-center gap-2">
                    <span
                        data-slot="color-entered"
                        className="flex min-w-0 items-center gap-1.5"
                    >
                        <span className="truncate text-xs">
                            {usesDefault ? t('Default') : t('Entered')}
                        </span>
                        <code className="text-xs font-semibold">
                            {enteredHex ?? t('Not a colour')}
                        </code>
                        <MiniSwatch hex={enteredHex} />
                    </span>
                    {palette !== null && (
                        <>
                            <ArrowRight
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                            />
                            <MiniSwatch hex={palette.light.primary} />
                        </>
                    )}
                </span>
            </div>
        </div>
    );
}
