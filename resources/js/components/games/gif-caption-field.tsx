import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const GifCaptionMaxLength = 60;

type Props = {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
};

/** The caption sent with a GIF (spec §6.7): 60 characters, with its counter. */
export function GifCaptionField({
    value,
    onChange,
    disabled = false,
    className,
}: Props) {
    const { t } = useTrans();
    const id = useId();
    const counterId = `${id}-count`;

    return (
        <div
            data-slot="gif-caption-field"
            className={cn('flex min-w-0 flex-col gap-1.5', className)}
        >
            <Label htmlFor={id}>{t('Caption')}</Label>
            <Input
                id={id}
                value={value}
                maxLength={GifCaptionMaxLength}
                disabled={disabled}
                placeholder={t('A short caption helps people vote.')}
                aria-describedby={counterId}
                onChange={(event) =>
                    onChange(event.target.value.slice(0, GifCaptionMaxLength))
                }
            />
            <span
                id={counterId}
                data-slot="gif-caption-count"
                className="self-end text-xs text-muted-foreground tabular-nums"
            >
                {t(':count / :max', {
                    count: value.length,
                    max: GifCaptionMaxLength,
                })}
            </span>
        </div>
    );
}
