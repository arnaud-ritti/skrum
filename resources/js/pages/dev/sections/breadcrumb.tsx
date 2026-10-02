import { Home } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="w-full max-w-xl min-w-0 rounded-lg border border-border bg-card p-3">
                {children}
            </div>
        </div>
    );
}

export default function BreadcrumbSection() {
    const { t } = useTrans();
    const crumb = (title: string) => ({ title, href: '#' });
    const long = [
        crumb('Équipe de développement produit et plateforme mutualisée'),
        crumb('Module de rétrospectives trimestrielles inter-équipes'),
        crumb(
            'Rétrospective du sprint de stabilisation après la mise en production',
        ),
    ];
    const seven = [
        'Home',
        'Team',
        'Module',
        'Retros',
        'Sprint 42',
        'Board',
        'Session',
    ].map((title) => crumb(title));

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('1 crumb (current page only)')}>
                <Breadcrumbs breadcrumbs={[crumb('Dashboard')]} />
            </Example>
            <Example label={t('3 crumbs')}>
                <Breadcrumbs
                    breadcrumbs={[
                        crumb('Teams'),
                        crumb('Alpha'),
                        crumb('Sprint review'),
                    ]}
                />
            </Example>
            <Example label={t('7 crumbs (ellipsis menu, max 4)')}>
                <Breadcrumbs breadcrumbs={seven} />
            </Example>
            <Example label={t('Slash separator')}>
                <Breadcrumbs
                    separator="slash"
                    breadcrumbs={[
                        crumb('Settings'),
                        crumb('Profile'),
                        crumb('Security'),
                    ]}
                />
            </Example>
            <Example label={t('Home icon (text hidden)')}>
                <Breadcrumbs
                    homeIcon
                    breadcrumbs={[
                        { ...crumb('Home'), icon: Home },
                        crumb('Teams'),
                        crumb('Alpha'),
                    ]}
                />
            </Example>
            <Example label={t('Long titles (truncated)')}>
                <Breadcrumbs breadcrumbs={long} />
            </Example>
            <Example
                label={t('Collapsed on mobile (back link and truncated title)')}
            >
                <Breadcrumbs collapseOnMobile breadcrumbs={long} />
            </Example>
        </div>
    );
}
