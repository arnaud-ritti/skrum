import { BenchSample } from '@/components/dev/bench';
import type { BenchGroup } from '@/components/dev/bench';
import { AuthFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'layouts';

export default function AuthSection() {
    const { t } = useTrans();

    return (
        <AuthFrame
            title={t('Log in to your account')}
            description={t('Enter your email and password below to log in')}
        >
            <BenchSample label="AuthLayout" />
        </AuthFrame>
    );
}
