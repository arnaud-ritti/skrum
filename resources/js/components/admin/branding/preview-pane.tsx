import { ArrowRight, Moon, Plus, Sun } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { paletteStyle } from './branding';
import type { Palette, ThemeName } from './branding';

type PreviewPaneProps = {
    palette: Palette | null;
    radius: number;
    /** Name shown in the bar. */
    name: string;
    /** Logo of each theme; the dark theme falls back on the light logo. */
    logos?: Partial<Record<ThemeName, string | null>>;
    /** The admin, drawn in the selected avatar style. */
    avatar?: { name: string; src?: string | null };
    defaultTheme?: ThemeName;
    loading?: boolean;
    className?: string;
};

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/);
    const letters =
        words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);

    return letters.toUpperCase();
}

/**
 * Real components under the candidate palette. The derived tokens are set on
 * the stage only, so the page around it keeps its own theme.
 */
export function PreviewPane({
    palette,
    radius,
    name,
    logos = {},
    avatar,
    defaultTheme = 'light',
    loading = false,
    className,
}: PreviewPaneProps) {
    const { t } = useTrans();
    const [theme, setTheme] = useState<ThemeName>(defaultTheme);
    const logo = logos[theme] ?? logos.light ?? null;

    return (
        <section
            data-slot="brand-preview"
            aria-label={t('Live preview')}
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-semibold">
                    {t('Live preview')}
                </h3>
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
                inert
                aria-busy={loading}
                className={cn(
                    theme,
                    'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background text-foreground transition-opacity duration-140 ease-standard motion-reduce:transition-none',
                    loading && 'opacity-60',
                )}
                style={paletteStyle(palette, theme, radius) as CSSProperties}
            >
                <div
                    data-slot="brand-preview-bar"
                    className="flex h-11 min-w-0 items-center gap-2 border-b bg-card px-3 text-sm font-bold"
                >
                    {logo === null ? (
                        <span
                            aria-hidden="true"
                            data-slot="brand-preview-mark"
                            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-overline font-extrabold tracking-normal text-primary-foreground"
                        >
                            {initialsOf(name)}
                        </span>
                    ) : (
                        <img
                            data-slot="brand-preview-logo"
                            src={logo}
                            alt=""
                            className="h-6 w-auto max-w-24 shrink-0 object-contain"
                        />
                    )}
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {avatar && (
                        <PersonAvatar
                            decorative
                            name={avatar.name}
                            size="xs"
                            presence={1}
                            src={avatar.src}
                        />
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-3 p-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button type="button" className="max-w-full min-w-0">
                            <Plus aria-hidden="true" />
                            <span className="truncate">{t('New retro')}</span>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="max-w-full min-w-0"
                        >
                            <span className="truncate">{t('Join')}</span>
                        </Button>
                    </div>
                    <div
                        data-slot="brand-preview-card"
                        className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-4 shadow-card"
                    >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-semibold">
                                {t('Sprint 42 retro')}
                            </span>
                            <Switch
                                defaultChecked
                                aria-label={t('Sample switch')}
                            />
                        </div>
                        <p className="text-body-sm text-muted-foreground">
                            {t('Thursday at 14:00, 9 participants')}
                        </p>
                        <span
                            data-slot="brand-preview-link"
                            className="mt-1.5 flex min-w-0 items-center gap-1 text-body-sm font-semibold text-skrum-primary-text"
                        >
                            <span className="truncate">
                                {t('See the 6 action items')}
                            </span>
                            <ArrowRight
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                            />
                        </span>
                    </div>
                    <div
                        data-slot="brand-preview-column-card"
                        className="col-moss rounded-lg border border-(--col-border) bg-(--col) p-3 text-sm"
                    >
                        {t('The customer demo went really well.')}
                    </div>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'Column and presence colours do not change: only the primary colour, the focus ring and the links follow the brand.',
                )}
            </p>
        </section>
    );
}
