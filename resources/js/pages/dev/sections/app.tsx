import { BenchSample, benchSidebar } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';

export const group: BenchGroup = 'layouts';

export default function AppSection() {
    return (
        <AppFrame
            sidebar={benchSidebar}
            topbar={
                <AppTopbar
                    breadcrumbs={[
                        { title: 'Nordlys', href: '/dev/design-system/app' },
                        { title: 'Atlas', href: '/dev/design-system/app' },
                    ]}
                />
            }
        >
            <BenchSample label="AppLayout" />
        </AppFrame>
    );
}
