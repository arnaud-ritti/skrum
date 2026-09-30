import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    value: string | null;
    face: 'empty' | 'down' | 'up';
    selected?: boolean;
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
};

export function PokerCard({
    value,
    face,
    selected = false,
    label,
    onClick,
    disabled = false,
}: Props) {
    const className = cn(
        'flex h-16 w-12 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-semibold transition',
        face === 'empty' && 'border-dashed border-muted-foreground/40',
        face === 'down' && 'border-primary bg-primary text-primary-foreground',
        face === 'up' && 'border-foreground/20 bg-background shadow-sm',
        selected && '-translate-y-2 border-primary ring-2 ring-primary/40',
        onClick &&
            !disabled &&
            'cursor-pointer hover:-translate-y-1 hover:border-primary',
        disabled && 'opacity-50',
    );
    const content =
        face === 'down' ? (
            <Check className="size-5" aria-hidden="true" />
        ) : face === 'up' ? (
            value
        ) : null;

    if (onClick) {
        return (
            <button
                type="button"
                className={className}
                aria-pressed={selected}
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <div role="img" aria-label={label} className={className}>
            {content}
        </div>
    );
}
