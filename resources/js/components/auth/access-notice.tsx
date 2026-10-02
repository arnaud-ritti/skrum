import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AccessNoticeTone = 'default' | 'warning' | 'destructive';

const markClasses: Record<AccessNoticeTone, string> = {
    default: 'bg-muted text-foreground',
    warning: 'bg-skrum-warning-soft text-skrum-warning-text',
    destructive: 'bg-skrum-destructive-soft text-skrum-destructive-text',
};

export type AccessNoticeProps = {
    icon: LucideIcon;
    title: string;
    description?: string;
    /** A second, muted line (e.g. "Guests: ask the facilitator for the guest link."). */
    hint?: string;
    tone?: AccessNoticeTone;
    action?: ReactNode;
};

export function AccessNotice({
    icon: Icon,
    title,
    description,
    hint,
    tone = 'default',
    action,
}: AccessNoticeProps) {
    return (
        <Card
            data-slot="access-notice"
            data-tone={tone}
            className="mx-auto w-full max-w-md items-start gap-4 p-6"
        >
            <span
                aria-hidden
                data-slot="access-notice-mark"
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    markClasses[tone],
                )}
            >
                <Icon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-xl font-title tracking-subheading break-words">
                    {title}
                </h2>
                {description !== undefined && (
                    <p className="text-sm/snug break-words">{description}</p>
                )}
                {hint !== undefined && (
                    <p className="text-sm/snug break-words text-muted-foreground">
                        {hint}
                    </p>
                )}
            </div>
            {action}
        </Card>
    );
}
