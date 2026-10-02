import { Check, Lock } from 'lucide-react';
import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import type { AvatarPresence } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type AvatarStyleOption = {
    value: string;
    name: string;
    license: string;
    attribution?: string;
    recommended?: boolean;
    sampleUrls: string[];
};

export type AvatarStylePickerProps = {
    value: string;
    onChange: (style: string) => void;
    options: AvatarStyleOption[];
    sampleNames: string[];
    /** Admin mode only: without the callback the switch is not rendered. */
    allowMemberChoice?: boolean;
    onAllowMemberChoiceChange?: (allow: boolean) => void;
    locked?: boolean;
    className?: string;
};

function presenceAt(index: number): AvatarPresence {
    return ((index % 12) + 1) as AvatarPresence;
}

function SampleAvatars({
    option,
    names,
    size,
}: {
    option: AvatarStyleOption;
    names: string[];
    size: 'md' | 'lg';
}) {
    return (
        <span className="flex items-center -space-x-2 *:rounded-full *:ring-2 *:ring-card">
            {names.map((name, index) => (
                <PersonAvatar
                    key={`${name}-${index}`}
                    decorative
                    name={name}
                    size={size}
                    presence={presenceAt(index)}
                    src={option.sampleUrls[index]}
                />
            ))}
        </span>
    );
}

export function AvatarStylePicker({
    value,
    onChange,
    options,
    sampleNames,
    allowMemberChoice = false,
    onAllowMemberChoiceChange,
    locked = false,
    className,
}: AvatarStylePickerProps) {
    const { t } = useTrans();
    const id = useId();
    const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const selected = options.find((option) => option.value === value);
    const focusableIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value),
    );
    const previewNames = sampleNames.slice(0, 4);

    function select(index: number): void {
        const option = options[index];

        if (locked || !option) {
            return;
        }

        tileRefs.current[index]?.focus();

        if (option.value !== value) {
            onChange(option.value);
        }
    }

    function handleKeyDown(
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void {
        const last = options.length - 1;
        const targets: Record<string, number> = {
            ArrowRight: index === last ? 0 : index + 1,
            ArrowDown: index === last ? 0 : index + 1,
            ArrowLeft: index === 0 ? last : index - 1,
            ArrowUp: index === 0 ? last : index - 1,
            Home: 0,
            End: last,
        };

        if (event.key === ' ') {
            event.preventDefault();
            select(index);

            return;
        }

        const target = targets[event.key];

        if (target === undefined) {
            return;
        }

        event.preventDefault();
        select(target);
    }

    return (
        <div
            data-slot="avatar-style-picker"
            className={cn('flex min-w-0 flex-col gap-4', className)}
        >
            {locked && (
                <p
                    data-slot="avatar-style-locked"
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                >
                    <Lock className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">
                        {t('Style imposed by the administrator')}
                    </span>
                </p>
            )}
            <div
                role="radiogroup"
                aria-label={t('Avatar style')}
                aria-disabled={locked || undefined}
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(38)),1fr))] gap-2"
            >
                {options.map((option, index) => {
                    const isSelected = option.value === value;
                    const licenseId = `${id}-license-${index}`;
                    const nameId = `${id}-name-${index}`;

                    return (
                        <button
                            key={option.value}
                            ref={(node) => {
                                tileRefs.current[index] = node;
                            }}
                            type="button"
                            role="radio"
                            data-slot="avatar-style-tile"
                            data-state={isSelected ? 'checked' : 'unchecked'}
                            aria-checked={isSelected}
                            aria-disabled={locked || undefined}
                            aria-labelledby={nameId}
                            aria-describedby={licenseId}
                            tabIndex={index === focusableIndex ? 0 : -1}
                            onClick={() => select(index)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={cn(
                                'relative flex min-w-0 flex-col items-start gap-2 rounded-lg border border-input bg-card p-3 text-left transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                                locked
                                    ? 'cursor-not-allowed opacity-70'
                                    : 'hover:bg-accent',
                                isSelected &&
                                    'border-primary bg-skrum-primary-soft',
                            )}
                        >
                            {isSelected && (
                                <span
                                    data-slot="avatar-style-check"
                                    aria-hidden
                                    className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                >
                                    <Check className="size-3" />
                                </span>
                            )}
                            <SampleAvatars
                                option={option}
                                names={sampleNames.slice(0, 3)}
                                size="md"
                            />
                            <span
                                id={nameId}
                                className={cn(
                                    'w-full truncate text-sm font-semibold',
                                    isSelected
                                        ? 'text-skrum-primary-text'
                                        : 'text-foreground',
                                )}
                            >
                                {option.name}
                            </span>
                            <span
                                id={licenseId}
                                className="flex w-full min-w-0 flex-wrap items-center gap-1"
                            >
                                <Badge
                                    variant={
                                        option.attribution ? 'warning' : 'muted'
                                    }
                                    className="max-w-full"
                                >
                                    <span className="truncate">
                                        {option.license}
                                    </span>
                                </Badge>
                                {option.recommended && (
                                    <Badge variant="outline">
                                        <span className="truncate">
                                            {t('Recommended')}
                                        </span>
                                    </Badge>
                                )}
                            </span>
                            {option.attribution && (
                                <span
                                    data-slot="avatar-style-attribution"
                                    className="line-clamp-2 w-full text-xs text-muted-foreground"
                                >
                                    {option.attribution}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {!locked && onAllowMemberChoiceChange !== undefined && (
                <label
                    data-slot="avatar-style-member-choice"
                    className="flex min-w-0 cursor-pointer items-center gap-3 text-sm font-medium"
                >
                    <Switch
                        checked={allowMemberChoice}
                        onCheckedChange={onAllowMemberChoiceChange}
                        className="cursor-pointer"
                    />
                    <span className="truncate">
                        {t('Members can choose their own style')}
                    </span>
                </label>
            )}
            {selected && previewNames.length > 0 && (
                <div
                    data-slot="avatar-style-preview"
                    role="group"
                    aria-label={t('Preview')}
                    className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-3"
                >
                    <span className="flex items-center gap-2">
                        {previewNames.map((name, index) => (
                            <PersonAvatar
                                key={`${name}-${index}`}
                                name={name}
                                size="lg"
                                presence={presenceAt(index)}
                                src={selected.sampleUrls[index]}
                            />
                        ))}
                    </span>
                    <span className="flex items-center gap-2">
                        {previewNames.slice(0, 2).map((name, index) => (
                            <PersonAvatar
                                key={`${name}-${index}`}
                                name={name}
                                size="md"
                                presence={presenceAt(index)}
                                src={selected.sampleUrls[index]}
                            />
                        ))}
                    </span>
                    <span className="flex items-center -space-x-2 *:rounded-full *:ring-2 *:ring-card">
                        {previewNames.map((name, index) => (
                            <PersonAvatar
                                key={`${name}-${index}`}
                                name={name}
                                size="md"
                                presence={presenceAt(index)}
                                src={selected.sampleUrls[index]}
                            />
                        ))}
                    </span>
                    <PersonAvatar name={t('Guest')} kind="guest" size="md" />
                </div>
            )}
        </div>
    );
}
