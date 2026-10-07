import { useId, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import UpdateChecksController from '@/actions/App/Http/Controllers/Admin/UpdateChecksController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Switch } from '@/components/ui/switch';
import { formatDaysAgo } from '@/lib/relative-date';
import { useTrans } from '@/hooks/use-trans';
import type { InstanceVersionStatus } from '@/lib/admin/types';
import { UpdateProcedure } from './update-procedure';

type UpdatesCardProps = {
    version: string;
    image: string;
    status: InstanceVersionStatus;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    error?: string;
};

export function UpdatesCard({
    version,
    image,
    status,
    enabled,
    onEnabledChange,
    error,
}: UpdatesCardProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const switchId = useId();
    const errorId = `${switchId}-error`;
    const [checking, setChecking] = useState(false);

    function checkNow(): void {
        router.post(
            UpdateChecksController.store.url(),
            {},
            {
                preserveScroll: true,
                onStart: () => setChecking(true),
                onFinish: () => setChecking(false),
            },
        );
    }

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

    const check = lastCheck();

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
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p
                        data-slot="update-last-check"
                        data-outdated={check.outdated ? '' : undefined}
                        className="min-w-0 text-body-sm text-muted-foreground data-[outdated]:font-medium data-[outdated]:text-skrum-warning-text"
                    >
                        {check.text}
                    </p>
                    <LoadingButton
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={checking}
                        onClick={checkNow}
                    >
                        {t('Check now')}
                    </LoadingButton>
                </div>
            </div>
            {status.releaseUrl !== null && (
                <a
                    href={status.releaseUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-slot="update-release-notes"
                    className="inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {t('Release notes')}
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{t('(opens in a new tab)')}</span>
                </a>
            )}
            <UpdateProcedure
                image={image}
                version={status.state === 'outdated' ? status.latest : null}
                defaultOpen={status.state === 'outdated'}
            />
        </SettingsCard>
    );
}
