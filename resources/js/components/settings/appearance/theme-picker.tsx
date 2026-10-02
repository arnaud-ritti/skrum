import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactElement } from 'react';
import { RadioGroup, RadioGroupCardItem } from '@/components/ui/radio-group';
import type { Appearance, ResolvedAppearance } from '@/hooks/use-appearance';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type ThemePickerProps = {
    value: Appearance;
    onChange: (value: Appearance) => void;
};

const previewColumns = [
    { colour: 'col-moss', notes: 2 },
    { colour: 'col-coral', notes: 1 },
    { colour: 'col-sky', notes: 2 },
] as const;

/** A small board drawn with the tokens of one theme, whatever the theme of the page. */
function ThemePreviewHalf({
    theme,
}: {
    theme: ResolvedAppearance;
}): ReactElement {
    return (
        <div
            data-theme={theme}
            className={cn(
                theme,
                'flex min-w-0 flex-1 bg-background text-foreground',
            )}
        >
            <div className="flex w-7/25 flex-col gap-1 border-r border-sidebar-border bg-sidebar p-1.5">
                <span className="block h-1.25 w-3/5 rounded-full bg-primary" />
                <span className="block h-1.25 rounded-full bg-muted-foreground opacity-35" />
                <span className="block h-1.25 rounded-full bg-muted-foreground opacity-35" />
                <span className="block h-1.25 rounded-full bg-muted-foreground opacity-35" />
            </div>
            <div className="flex min-w-0 flex-1 gap-1 p-1.75">
                {previewColumns.map(({ colour, notes }) => (
                    <div
                        key={colour}
                        className={cn(
                            colour,
                            'flex min-w-0 flex-1 flex-col gap-0.75 rounded-sm border border-[color-mix(in_oklch,var(--col-border)_50%,transparent)] bg-[color-mix(in_oklch,var(--col)_45%,var(--skrum-canvas))] p-0.75',
                        )}
                    >
                        {Array.from({ length: notes }, (_, index) => (
                            <span
                                key={index}
                                className="block h-2.5 rounded-xs border border-(--col-border) bg-(--col)"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ThemePicker({
    value,
    onChange,
}: ThemePickerProps): ReactElement {
    const { t } = useTrans();
    const labelId = useId();

    const themes: {
        value: Appearance;
        label: string;
        icon: LucideIcon;
        halves: ResolvedAppearance[];
    }[] = [
        {
            value: 'system',
            label: t('System'),
            icon: Monitor,
            halves: ['light', 'dark'],
        },
        { value: 'light', label: t('Light'), icon: Sun, halves: ['light'] },
        { value: 'dark', label: t('Dark'), icon: Moon, halves: ['dark'] },
    ];

    return (
        <div data-slot="theme-picker" className="flex min-w-0 flex-col gap-2">
            <span id={labelId} className="text-sm font-medium">
                {t('Theme')}
            </span>
            <RadioGroup<Appearance>
                aria-labelledby={labelId}
                value={value}
                onValueChange={onChange}
                className="grid-cols-3 gap-3 max-sm:gap-2"
            >
                {themes.map(({ value: theme, label, icon: Icon, halves }) => (
                    <RadioGroupCardItem
                        key={theme}
                        value={theme}
                        className="rounded-xl border-input p-2 shadow-none data-[state=checked]:bg-card"
                    >
                        <span
                            data-slot="theme-preview"
                            aria-hidden="true"
                            className="flex h-22 overflow-hidden rounded-lg border max-sm:h-14"
                        >
                            {halves.map((half) => (
                                <ThemePreviewHalf key={half} theme={half} />
                            ))}
                        </span>
                        <span className="flex min-w-0 items-center gap-2 px-1 pb-0.5 text-sm font-semibold max-sm:gap-1.5 max-sm:px-0">
                            <span
                                aria-hidden="true"
                                className="grid size-4 shrink-0 place-items-center rounded-full border border-input bg-card group-data-[state=checked]/radio-card:border-primary"
                            >
                                <span className="hidden size-2 rounded-full bg-primary group-data-[state=checked]/radio-card:block" />
                            </span>
                            <Icon
                                aria-hidden="true"
                                className="size-4 shrink-0 max-sm:hidden"
                            />
                            <span className="truncate">{label}</span>
                        </span>
                    </RadioGroupCardItem>
                ))}
            </RadioGroup>
        </div>
    );
}
