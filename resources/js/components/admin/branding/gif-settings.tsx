import { KeyRound, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { useId, useState } from 'react';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { GifProvider, GifRating } from './branding';
import { DefaultHint } from './default-hint';

const NoProvider = 'none';

const Ratings: GifRating[] = ['g', 'pg', 'pg-13', 'r'];

export type GifSettingsValue = {
    provider: GifProvider | '';
    enabled: boolean;
    rating: GifRating;
    /** A key typed in this form. A stored key never reaches the browser. */
    key: string;
    keyClear: boolean;
};

export type GifSettingsErrors = Partial<
    Record<'provider' | 'enabled' | 'rating' | 'key', string>
>;

export type GifSettingsProps = {
    value: GifSettingsValue;
    onChange: (patch: Partial<GifSettingsValue>) => void;
    hasKey: boolean;
    /** Fields that show the default because nothing is stored for them. */
    defaulted?: Partial<Record<'provider' | 'enabled' | 'rating', boolean>>;
    errors?: GifSettingsErrors;
    className?: string;
};

function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <span
            data-slot="field-error"
            className="text-body-sm text-skrum-destructive-text"
        >
            {message}
        </span>
    );
}

export function GifSettings({
    value,
    onChange,
    hasKey,
    defaulted = {},
    errors = {},
    className,
}: GifSettingsProps) {
    const { t } = useTrans();
    const id = useId();
    const [replacing, setReplacing] = useState(false);
    const showsKeyInput = !hasKey || replacing;
    const keyFieldLabel = hasKey ? t('New API key') : t('API key');

    return (
        <div
            data-slot="gif-settings"
            className={cn('flex min-w-0 flex-col gap-4', className)}
        >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(48)),1fr))] gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <Label
                            htmlFor={`${id}-provider`}
                            className="min-w-0 truncate"
                        >
                            {t('Provider')}
                        </Label>
                        {defaulted.provider && <DefaultHint />}
                    </div>
                    <Select
                        value={
                            value.provider === '' ? NoProvider : value.provider
                        }
                        onValueChange={(next) =>
                            onChange({
                                provider:
                                    next === NoProvider
                                        ? ''
                                        : (next as GifProvider),
                            })
                        }
                    >
                        <SelectTrigger
                            id={`${id}-provider`}
                            aria-invalid={errors.provider ? true : undefined}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NoProvider}>
                                {t('None')}
                            </SelectItem>
                            <SelectItem value="giphy">Giphy</SelectItem>
                            <SelectItem value="tenor">Tenor</SelectItem>
                        </SelectContent>
                    </Select>
                    <FieldError message={errors.provider} />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <Label
                            htmlFor={`${id}-rating`}
                            className="min-w-0 truncate"
                        >
                            {t('Content rating')}
                        </Label>
                        {defaulted.rating && <DefaultHint />}
                    </div>
                    <Select
                        value={value.rating}
                        onValueChange={(next) =>
                            onChange({ rating: next as GifRating })
                        }
                    >
                        <SelectTrigger
                            id={`${id}-rating`}
                            aria-invalid={errors.rating ? true : undefined}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Ratings.map((rating) => (
                                <SelectItem key={rating} value={rating}>
                                    {rating.toUpperCase()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError message={errors.rating} />
                </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
                <Switch
                    checked={value.enabled}
                    onCheckedChange={(enabled) => onChange({ enabled })}
                    label={t('GIFs enabled')}
                    description={
                        <>
                            {t(
                                'GIFs appear only with a provider and an API key.',
                            )}
                            {defaulted.enabled && (
                                <DefaultHint className="ml-2" />
                            )}
                        </>
                    }
                />
                <FieldError message={errors.enabled} />
            </div>
            <div data-slot="gif-key" className="flex min-w-0 flex-col gap-2">
                {hasKey && !replacing && !value.keyClear && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                            data-slot="gif-key-state"
                            className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm font-medium"
                        >
                            <KeyRound
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">
                                {t('A key is set')}
                            </span>
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setReplacing(true)}
                            className="max-w-full min-w-0"
                        >
                            <RefreshCw aria-hidden="true" />
                            <span className="truncate">{t('Replace')}</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                onChange({ keyClear: true, key: '' })
                            }
                            className="max-w-full min-w-0 text-skrum-destructive-text"
                        >
                            <Trash2 aria-hidden="true" />
                            <span className="truncate">{t('Remove key')}</span>
                        </Button>
                    </div>
                )}
                {hasKey && value.keyClear && !replacing && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                            data-slot="gif-key-state"
                            className="min-w-0 flex-1 basis-40 text-sm text-skrum-warning-text"
                        >
                            {t('The key is removed when you save.')}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onChange({ keyClear: false })}
                            className="max-w-full min-w-0"
                        >
                            <Undo2 aria-hidden="true" />
                            <span className="truncate">
                                {t('Keep the key')}
                            </span>
                        </Button>
                    </div>
                )}
                {showsKeyInput && (
                    <div className="flex min-w-0 flex-col items-start gap-2">
                        <TextField
                            type="password"
                            autoComplete="off"
                            label={keyFieldLabel}
                            description={
                                hasKey
                                    ? t(
                                          'The current key stays until you save a new one.',
                                      )
                                    : t(
                                          'Stored encrypted. It is never shown again.',
                                      )
                            }
                            error={errors.key}
                            value={value.key}
                            maxLength={255}
                            onChange={(event) =>
                                onChange({
                                    key: event.target.value,
                                    keyClear: false,
                                })
                            }
                            wrapperClassName="w-full"
                        />
                        {hasKey && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setReplacing(false);
                                    onChange({ key: '' });
                                }}
                                className="max-w-full min-w-0"
                            >
                                <Undo2 aria-hidden="true" />
                                <span className="truncate">
                                    {t('Keep the current key')}
                                </span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
