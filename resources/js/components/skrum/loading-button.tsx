import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LoadingButtonProps = ComponentProps<typeof Button> & {
    loading?: boolean;
    loader?: 'spinner' | 'trema';
};

function Loader({ kind }: { kind: 'spinner' | 'trema' }) {
    if (kind === 'trema') {
        return (
            <span
                aria-hidden="true"
                data-slot="loader"
                data-loader="trema"
                className="inline-flex items-center gap-1"
            >
                <span className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                <span
                    className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none"
                    style={{ animationDelay: '180ms' }}
                />
            </span>
        );
    }

    return (
        <Loader2Icon
            aria-hidden="true"
            data-slot="loader"
            data-loader="spinner"
            className="size-4 animate-spin motion-reduce:animate-none"
        />
    );
}

export function LoadingButton({
    loading = false,
    loader = 'spinner',
    asChild = false,
    disabled,
    className,
    children,
    ...props
}: LoadingButtonProps) {
    if (!loading) {
        return (
            <Button
                asChild={asChild}
                disabled={disabled}
                className={className}
                {...props}
            >
                {children}
            </Button>
        );
    }

    if (asChild) {
        return (
            <Button
                asChild
                aria-busy="true"
                aria-disabled="true"
                data-loading="true"
                className={cn('pointer-events-none opacity-50', className)}
                {...props}
            >
                {children}
            </Button>
        );
    }

    return (
        <Button
            disabled
            aria-busy="true"
            data-loading="true"
            className={cn('[&>svg:not([data-slot=loader])]:hidden', className)}
            {...props}
        >
            <Loader kind={loader} />
            {children}
        </Button>
    );
}
