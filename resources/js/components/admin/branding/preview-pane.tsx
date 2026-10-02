import { Check, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { paletteStyle } from './branding';
import type { Palette, ThemeName } from './branding';
import { ContrastBadge } from './contrast-badge';

export type PreviewPaneProps = {
    palette: Palette | null;
    radius: number;
    defaultTheme?: ThemeName;
    loading?: boolean;
    className?: string;
};

/**
 * Real components under the candidate palette. The derived tokens are set on
 * the stage only, so the page around it keeps its own theme.
 */
export function PreviewPane({
    palette,
    radius,
    defaultTheme = 'light',
    loading = false,
    className,
}: PreviewPaneProps) {
    const { t } = useTrans();
    const [theme, setTheme] = useState<ThemeName>(defaultTheme);

    return (
        <section
            data-slot="brand-preview"
            aria-label={t('Live preview')}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-card',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-base font-title">
                    {t('Live preview')}
                </h2>
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-label={t('Preview theme')}
                    value={theme}
                    onValueChange={setTheme}
                    options={[
                        { value: 'light', label: t('Light'), icon: Sun },
                        { value: 'dark', label: t('Dark'), icon: Moon },
                    ]}
                />
            </div>
            <div
                data-slot="brand-preview-stage"
                data-theme={theme}
                aria-busy={loading}
                className={cn(
                    theme,
                    'flex min-w-0 flex-col gap-4 rounded-lg border bg-background p-4 text-foreground transition-opacity duration-140 ease-standard motion-reduce:transition-none',
                    loading && 'opacity-60',
                )}
                style={paletteStyle(palette, theme, radius) as CSSProperties}
            >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button type="button" className="max-w-full min-w-0">
                        <span className="truncate">{t('Start the retro')}</span>
                    </Button>
                    <Badge variant="soft" className="max-w-full">
                        <span className="truncate">{t('Facilitator')}</span>
                    </Badge>
                </div>
                <div
                    data-slot="brand-preview-card"
                    className="flex min-w-0 items-start gap-3 rounded-lg border border-primary bg-skrum-primary-soft p-3"
                >
                    <span
                        aria-hidden="true"
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                        <Check className="size-3" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-skrum-primary-text">
                            {t('Selected card')}
                        </span>
                        <span className="text-body-sm text-muted-foreground">
                            {t('Links and active states use the brand colour.')}
                        </span>
                    </span>
                </div>
                <div
                    data-slot="brand-preview-focus"
                    className="flex h-9 min-w-0 items-center rounded-md border border-ring bg-card px-3 text-sm ring-2 ring-ring"
                >
                    <span className="truncate">{t('Keyboard focus')}</span>
                </div>
                {palette !== null && (
                    <ContrastBadge ratio={palette.ratios[theme].onPrimary} />
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'Column, presence and status colours stay the same for every brand.',
                )}
            </p>
        </section>
    );
}
