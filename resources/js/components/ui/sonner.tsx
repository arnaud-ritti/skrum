import { useAppearance } from '@/hooks/use-appearance';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
    CircleCheck,
    CircleX,
    Info,
    LoaderCircle,
    TriangleAlert,
    X,
} from 'lucide-react';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Sonner injects its own stylesheet outside any cascade layer, so it wins over
 * Tailwind utilities. Colours and radius go through its CSS variables; every
 * other override needs the important modifier.
 */
const toastClassNames = {
    toast: 'items-start! gap-2! shadow-popover! duration-220! ease-enter!',
    content: 'gap-0.5!',
    title: 'text-sm! leading-5! font-semibold!',
    description: 'text-body-sm! text-muted-foreground!',
    icon: 'mt-0.5!',
    success: '[&_[data-icon]]:text-skrum-success-text',
    info: '[&_[data-icon]]:text-skrum-info-text',
    warning: '[&_[data-icon]]:text-skrum-warning-text',
    error: '[&_[data-icon]]:text-skrum-destructive-text',
    loading: '[&_[data-icon]]:text-muted-foreground',
    actionButton:
        'h-8! self-center! rounded-md! border! border-input! bg-card! px-3! text-sm! font-semibold! whitespace-nowrap! text-foreground! shadow-xs! transition-colors! duration-140! hover:bg-accent! hover:text-accent-foreground! focus-visible:ring-2! focus-visible:ring-ring! focus-visible:ring-offset-2! focus-visible:ring-offset-background!',
    cancelButton:
        'h-8! self-center! rounded-md! bg-transparent! px-3! text-sm! font-semibold! whitespace-nowrap! text-foreground! transition-colors! duration-140! hover:bg-accent! hover:text-accent-foreground! focus-visible:ring-2! focus-visible:ring-ring! focus-visible:ring-offset-2! focus-visible:ring-offset-background!',
    closeButton:
        'border-border! bg-popover! text-muted-foreground! hover:bg-accent! hover:text-accent-foreground! focus-visible:ring-2! focus-visible:ring-ring!',
} satisfies NonNullable<ToasterProps['toastOptions']>['classNames'];

type ToastClassName = keyof typeof toastClassNames;

/**
 * The Toaster sits outside the Inertia page, where usePage cannot reach: the
 * name of its region starts from the first page and follows each visit.
 */
function useRegionLabel(initial?: string): string | undefined {
    const [label, setLabel] = useState(initial);

    useEffect(
        () =>
            router.on('navigate', (event) => {
                setLabel(event.detail.page.props.translations?.Notifications);
            }),
        [],
    );

    return label;
}

function Toaster({
    toastOptions,
    icons,
    style,
    containerAriaLabel,
    ...props
}: ToasterProps) {
    const { appearance } = useAppearance();
    const isMobile = useIsMobile();
    const regionLabel = useRegionLabel(containerAriaLabel);

    useFlashToast();

    const classNames = { ...toastOptions?.classNames };

    (Object.keys(toastClassNames) as ToastClassName[]).forEach((key) => {
        classNames[key] = cn(toastClassNames[key], toastOptions?.classNames?.[key]);
    });

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position={isMobile ? 'top-center' : 'bottom-right'}
            richColors={false}
            visibleToasts={3}
            containerAriaLabel={regionLabel}
            icons={{
                success: <CircleCheck aria-hidden="true" className="size-4" />,
                info: <Info aria-hidden="true" className="size-4" />,
                warning: <TriangleAlert aria-hidden="true" className="size-4" />,
                error: <CircleX aria-hidden="true" className="size-4" />,
                loading: (
                    <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                    />
                ),
                close: <X aria-hidden="true" className="size-3" />,
                ...icons,
            }}
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': 'var(--radius)',
                    ...style,
                } as React.CSSProperties
            }
            toastOptions={{
                duration: 5000,
                ...toastOptions,
                classNames,
            }}
            {...props}
        />
    );
}

export { Toaster };
