import { cn } from '@/lib/utils';

/** The "or with your e-mail" line between the sign-in buttons and the form. */
export function AuthSeparator({
    label,
    className,
}: {
    label: string;
    className?: string;
}) {
    return (
        <div
            data-slot="auth-separator"
            className={cn('flex items-center gap-3', className)}
        >
            <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
            <span className="min-w-0 text-center text-xs text-muted-foreground">
                {label}
            </span>
            <span aria-hidden className="h-px min-w-4 flex-1 bg-border" />
        </div>
    );
}
