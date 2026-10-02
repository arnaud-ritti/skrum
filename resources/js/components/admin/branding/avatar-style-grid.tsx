import { Grid2x2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { FeaturedAvatarStyles } from './branding';
import type { AdminAvatarStyle } from './branding';

export type AvatarStyleGridProps = {
    value: string;
    onChange: (style: string) => void;
    options: AdminAvatarStyle[];
    /** Whose avatar is drawn in each tile. */
    sampleName: string;
    allowMemberChoice: boolean;
    onAllowMemberChoiceChange: (allow: boolean) => void;
    className?: string;
};

const tile =
    'flex min-w-0 flex-col items-center gap-1.5 rounded-lg border bg-card px-1 py-2 text-xs font-semibold outline-none transition-colors duration-140 ease-standard hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none';

/**
 * The short list of the mockup, then every installed style behind the last
 * tile. The selected style is always among the tiles.
 */
export function AvatarStyleGrid({
    value,
    onChange,
    options,
    sampleName,
    allowMemberChoice,
    onAllowMemberChoiceChange,
    className,
}: AvatarStyleGridProps) {
    const { t } = useTrans();
    const id = useId();
    const [expanded, setExpanded] = useState(false);
    const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const featured = FeaturedAvatarStyles.flatMap((style) =>
        options.filter((option) => option.value === style),
    );
    const shortList = featured.some((option) => option.value === value)
        ? featured
        : [...featured, ...options.filter((option) => option.value === value)];
    const collapsible =
        shortList.length > 0 && shortList.length < options.length;
    const visible = expanded || !collapsible ? options : shortList;
    const focusableIndex = Math.max(
        0,
        visible.findIndex((option) => option.value === value),
    );

    function select(index: number): void {
        const option = visible[index];

        if (!option) {
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
        const last = visible.length - 1;
        const targets: Record<string, number> = {
            ArrowRight: index === last ? 0 : index + 1,
            ArrowDown: index === last ? 0 : index + 1,
            ArrowLeft: index === 0 ? last : index - 1,
            ArrowUp: index === 0 ? last : index - 1,
            Home: 0,
            End: last,
        };
        const target = event.key === ' ' ? index : targets[event.key];

        if (target === undefined) {
            return;
        }

        event.preventDefault();
        select(target);
    }

    return (
        <div
            data-slot="avatar-style-grid"
            className={cn('flex min-w-0 flex-col gap-3', className)}
        >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(22),1fr))] gap-2">
                <div
                    role="radiogroup"
                    aria-label={t('Avatar style')}
                    className="contents"
                >
                    {visible.map((option, index) => {
                        const isSelected = option.value === value;
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
                                data-state={
                                    isSelected ? 'checked' : 'unchecked'
                                }
                                aria-checked={isSelected}
                                aria-labelledby={nameId}
                                title={option.license}
                                tabIndex={index === focusableIndex ? 0 : -1}
                                onClick={() => select(index)}
                                onKeyDown={(event) =>
                                    handleKeyDown(event, index)
                                }
                                className={cn(
                                    tile,
                                    isSelected
                                        ? 'border-primary bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset'
                                        : 'border-input',
                                )}
                            >
                                <PersonAvatar
                                    decorative
                                    name={sampleName}
                                    size="lg"
                                    presence={1}
                                    src={option.sampleUrls[0]}
                                />
                                <span
                                    id={nameId}
                                    className="max-w-full truncate"
                                >
                                    {option.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {collapsible && (
                    <button
                        type="button"
                        data-slot="avatar-style-more"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((open) => !open)}
                        className={cn(
                            tile,
                            'justify-center border-dashed border-input text-muted-foreground',
                        )}
                    >
                        <Grid2x2 aria-hidden="true" className="size-6" />
                        <span className="max-w-full truncate">
                            {t(':count styles', { count: options.length })}
                        </span>
                    </button>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(
                    'DiceBear avatars drawn from the identifier of each member, on their presence colour. CC BY styles show their attribution on the About page.',
                )}
            </p>
            <label
                data-slot="avatar-style-member-choice"
                className="flex min-w-0 cursor-pointer items-center gap-3 text-sm font-medium"
            >
                <Switch
                    checked={allowMemberChoice}
                    onCheckedChange={onAllowMemberChoiceChange}
                    className="cursor-pointer"
                />
                <span className="min-w-0">
                    {t('Members can choose their own style')}
                </span>
            </label>
        </div>
    );
}
