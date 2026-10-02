import { CircleAlert } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** The error line of a field, drawn as the design system's TextField draws its own. */
export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    return message ? (
        <p
            data-slot="field-error"
            {...props}
            className={cn(
                'flex items-center gap-1.5 text-body-sm text-skrum-destructive-text',
                className,
            )}
        >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {message}
        </p>
    ) : null;
}
