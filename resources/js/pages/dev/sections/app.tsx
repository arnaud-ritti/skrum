import { BenchSample, benchSidebar } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function AppSection() {
    const { t } = useTrans();

    return (
        <AppFrame
            sidebar={{
                ...benchSidebar,
                newTeamHref: '/dev/design-system/app',
                overdueActions: 3,
                user: {
                    name: 'Ada Lovelace',
                    role: t('Team admin'),
                    avatarUrl: null,
                    menu: (
                        <DropdownMenuItem>
                            {t('Account settings')}
                        </DropdownMenuItem>
                    ),
                },
            }}
            topbar={<AppTopbar title="Atlas" />}
        >
            <BenchSample label="AppLayout" />
        </AppFrame>
    );
}
