import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Trema } from '@/components/skrum/trema';
import { cn } from '@/lib/utils';

export type LoadingButtonProps = ComponentProps<typeof Button> & {
    loading?: boolean;
    loader?: 'spinner' | 'trema';
};

function Loader({ kind }: { kind: 'spinner' | 'trema' }) {
    if (kind === 'trema') {
        return <Trema data-slot="loader" data-loader="trema" />;
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
                tabIndex={-1}
                onClick={(event) => event.preventDefault()}
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
