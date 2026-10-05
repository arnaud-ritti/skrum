import { useId } from 'react';
import { usePage } from '@inertiajs/react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Switch } from '@/components/ui/switch';
import { formatDaysAgo } from '@/lib/days-ago';
import { useTrans } from '@/hooks/use-trans';
import type { InstanceVersionStatus } from '@/lib/admin/types';

type UpdatesCardProps = {
    version: string;
    status: InstanceVersionStatus;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    error?: string;
};

export function UpdatesCard({
    version,
    status,
    enabled,
    onEnabledChange,
    error,
}: UpdatesCardProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const switchId = useId();
    const errorId = `${switchId}-error`;

    function lastCheck(): { text: string; outdated: boolean } {
        if (status.state === 'unreleased') {
            return {
                text: t(
                    'This build is not a release: it is not compared with new versions.',
                ),
                outdated: false,
            };
        }

        if (status.checkedAt === null || status.state === 'unknown') {
            return { text: t('Never checked.'), outdated: false };
        }

        const relative = formatDaysAgo(status.checkedAt, locale, Date.now());

        if (status.state === 'outdated' && status.latest !== null) {
            return {
                text: t('Checked :relative: v:version is available.', {
                    relative,
                    version: status.latest,
                }),
                outdated: true,
            };
        }

        return {
            text: t('Checked :relative: up to date.', { relative }),
            outdated: false,
        };
    }

    const check = enabled ? lastCheck() : null;

    return (
        <SettingsCard
            title={t('Updates')}
            description={t(
                'The version of the instance and the check for new ones.',
            )}
        >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{t('Version')}</span>
                <span data-slot="general-version" className="font-mono text-sm">
                    v{version}
                </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
                <Switch
                    id={switchId}
                    {...(error !== undefined && {
                        'aria-describedby': errorId,
                    })}
                    checked={enabled}
                    onCheckedChange={onEnabledChange}
                    label={
                        <span className="font-medium">
                            {t('Check for new versions once a day')}
                        </span>
                    }
                    description={t(
                        'The instance asks GitHub once a day; nothing about the instance is sent.',
                    )}
                    aria-invalid={error ? true : undefined}
                />
                {error !== undefined && (
                    <p
                        id={errorId}
                        role="alert"
                        data-slot="field-error"
                        className="text-body-sm text-skrum-destructive-text"
                    >
                        {error}
                    </p>
                )}
                {check !== null && (
                    <p
                        data-slot="update-last-check"
                        data-outdated={check.outdated ? '' : undefined}
                        className="text-body-sm text-muted-foreground data-[outdated]:font-medium data-[outdated]:text-skrum-warning-text"
                    >
                        {check.text}
                    </p>
                )}
            </div>
        </SettingsCard>
    );
}
