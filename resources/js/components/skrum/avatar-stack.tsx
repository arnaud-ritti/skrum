import { useState } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import type { PersonAvatarProps } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type AvatarStackPerson = Pick<
    PersonAvatarProps,
    'name' | 'presence' | 'src' | 'status' | 'typing' | 'kind'
>;

export interface AvatarStackProps {
    people: AvatarStackPerson[];
    max?: number;
    size?: PersonAvatarProps['size'];
    className?: string;
}

const overflowSizeClasses = {
    xs: 'size-5 text-overline tracking-normal',
    sm: 'size-6 text-overline tracking-normal',
    md: 'size-8 text-xs',
    lg: 'size-10 text-body-sm',
    xl: 'size-14 text-ui-lg',
};

export function AvatarStack({
    people,
    max = 5,
    size = 'md',
    className,
}: AvatarStackProps) {
    const { t } = useTrans();
    const [initialCount] = useState(people.length);
    const visibleCount = Math.max(0, max);
    const visible = people.slice(0, visibleCount);
    const hiddenCount = people.length - visible.length;

    return (
        <div
            data-slot="avatar-stack"
            role="group"
            className={cn(
                'flex items-center -space-x-2 *:rounded-full *:ring-2 *:ring-background',
                className,
            )}
        >
            {visible.map((person, index) => (
                <PersonAvatar
                    key={index}
                    {...person}
                    size={size}
                    className={cn(
                        index >= initialCount &&
                            'animate-in duration-220 ease-spring zoom-in-50 fade-in motion-reduce:animate-none',
                    )}
                />
            ))}
            {hiddenCount > 0 && (
                <span
                    data-slot="avatar-stack-more"
                    role="img"
                    aria-label={t(':count more', { count: hiddenCount })}
                    className={cn(
                        'inline-flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground',
                        overflowSizeClasses[size],
                    )}
                >
                    +{hiddenCount}
                </span>
            )}
        </div>
    );
}
