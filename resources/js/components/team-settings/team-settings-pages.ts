import {
    CalendarRange,
    Database,
    HeartPulse,
    Layers,
    Plug,
    Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import TeamDataController from '@/actions/App/Http/Controllers/TeamDataController';
import TeamHealthStatementsController from '@/actions/App/Http/Controllers/TeamHealthStatementsController';
import TeamRetroSettingsController from '@/actions/App/Http/Controllers/TeamRetroSettingsController';
import TeamSettingsController from '@/actions/App/Http/Controllers/TeamSettingsController';
import TeamSprintsController from '@/actions/App/Http/Controllers/TeamSprintsController';
import type { TeamSettingsSections } from '@/types';

export type TeamSettingsSection = Exclude<
    keyof TeamSettingsSections,
    'firstUrl'
>;

export type TeamSettingsPage = {
    section: TeamSettingsSection;
    label: string;
    icon: LucideIcon;
    href: string;
};

/** The pages of the team settings, in the order of their navigation: its entries and the palette's come from here. */
export function teamSettingsPages(
    scope: { workspace: string; team: string },
    t: (key: string) => string,
): TeamSettingsPage[] {
    return [
        {
            section: 'general',
            label: t('General'),
            icon: Settings,
            href: TeamSettingsController.show.url(scope),
        },
        {
            section: 'sprints',
            label: t('Sprints'),
            icon: CalendarRange,
            href: TeamSprintsController.index.url(scope),
        },
        {
            section: 'retros',
            label: t('Retrospectives'),
            icon: Layers,
            href: TeamRetroSettingsController.show.url(scope),
        },
        {
            section: 'health',
            label: t('Health check'),
            icon: HeartPulse,
            href: TeamHealthStatementsController.index.url(scope),
        },
        {
            section: 'integrations',
            label: t('Integrations'),
            icon: Plug,
            href: TeamIntegrationsController.index.url(scope),
        },
        {
            section: 'data',
            label: t('Data & export'),
            icon: Database,
            href: TeamDataController.show.url(scope),
        },
    ];
}
