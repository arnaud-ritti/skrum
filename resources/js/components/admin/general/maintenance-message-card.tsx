import { usePage } from '@inertiajs/react';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';

/** `InstanceSettings::MaintenanceMessageMaxLength`. */
export const MaintenanceMessageMaxLength = 280;

type MaintenanceMessageCardProps = {
    value: string;
    savedBy: { name: string } | null;
    savedAt: string | null;
    onChange: (value: string) => void;
    error?: string;
};

export function MaintenanceMessageCard({
    value,
    savedBy,
    savedAt,
    onChange,
    error,
}: MaintenanceMessageCardProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const fieldId = useId();
    const errorId = useId();
    const hintId = useId();
    const length = value.trim().length;
    const over = length > MaintenanceMessageMaxLength;
    const shownError = over
        ? t('Keep the message to :max characters.', {
              max: MaintenanceMessageMaxLength,
          })
        : error;
    const [beforeCommand, afterCommand] = t(
        'Shown on the maintenance page from the next :command.',
    ).split(':command');
    const savedLine =
        savedBy !== null && savedAt !== null
            ? t('Saved by :name, :date', {
                  name: savedBy.name,
                  date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                  }).format(new Date(savedAt)),
              })
            : null;

    return (
        <SettingsCard
            title={t('Maintenance message')}
            description={t(
                'A note for everyone while the instance is down for maintenance.',
            )}
            footer={
                <>
                    {savedLine !== null && (
                        <span
                            data-slot="maintenance-saved-by"
                            className="mr-auto min-w-0 text-xs text-muted-foreground"
                        >
                            {savedLine}
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={value === ''}
                        onClick={() => onChange('')}
                    >
                        {t('Clear')}
                    </Button>
                </>
            }
        >
            <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={fieldId}>{t('Message')}</Label>
                <Textarea
                    id={fieldId}
                    value={value}
                    rows={3}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={shownError ? true : undefined}
                    aria-describedby={shownError ? errorId : hintId}
                />
                <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        {shownError !== undefined ? (
                            <p
                                id={errorId}
                                data-slot="field-error"
                                className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                            >
                                <CircleAlert
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span className="min-w-0">{shownError}</span>
                            </p>
                        ) : (
                            <p
                                id={hintId}
                                className="text-body-sm text-muted-foreground"
                            >
                                {beforeCommand}
                                <code className="font-mono">artisan down</code>
                                {afterCommand}
                            </p>
                        )}
                    </div>
                    <span
                        data-slot="maintenance-counter"
                        data-over={over ? '' : undefined}
                        className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums data-[over]:font-semibold data-[over]:text-skrum-destructive-text"
                    >
                        {`${length}/${MaintenanceMessageMaxLength}`}
                    </span>
                </div>
            </div>
        </SettingsCard>
    );
}
