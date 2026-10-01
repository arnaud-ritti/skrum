import { BenchSample, benchSidebar } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { SessionFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function SessionSection() {
    const { t } = useTrans();

    return (
        <SessionFrame
            sidebar={{ ...benchSidebar, active: 'sessions' }}
            title={t('Sprint :number retro', { number: 42 })}
        >
            <div className="p-6">
                <BenchSample label="SessionLayout" />
            </div>
        </SessionFrame>
    );
}
