import { ExternalLink } from 'lucide-react';
import type { ReactElement } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { LicencePageProps } from '@/lib/admin/types';

type LicenceCardProps = Pick<
    LicencePageProps,
    'licence' | 'licenceUrl' | 'repositoryUrl' | 'accountsInUse'
>;

function ExternalLinkTo({ href, label }: { href: string; label: string }) {
    const { t } = useTrans();

    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            {label}
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{t('(opens in a new tab)')}</span>
        </a>
    );
}

/** The mockup's licence card, informative: the project's licence, no key, no seat limit. */
export function LicenceCard({
    licence,
    licenceUrl,
    repositoryUrl,
    accountsInUse,
}: LicenceCardProps): ReactElement {
    const { t } = useTrans();

    return (
        <SettingsCard title={t('Licence')}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <span className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <span className="font-semibold">Skrüm</span>
                    <span className="text-xs text-muted-foreground">
                        {t(
                            'Open source under the GNU Affero General Public License v3.0 or later; every feature is included.',
                        )}
                    </span>
                </span>
                <Badge variant="success" data-slot="licence-badge">
                    {licence}
                </Badge>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span>{t('Accounts in use')}</span>
                <span
                    data-slot="licence-accounts"
                    className="font-semibold tabular-nums"
                >
                    {accountsInUse}
                </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">
                    {t('No limit, no expiry.')}
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <ExternalLinkTo
                        href={licenceUrl}
                        label={t('Licence text')}
                    />
                    <ExternalLinkTo
                        href={repositoryUrl}
                        label={t('Source code')}
                    />
                </span>
            </div>
        </SettingsCard>
    );
}
