import { LanguageSwitcher } from '@/components/language-switcher';
import { useTrans } from '@/hooks/use-trans';
import AuthLayoutTemplate from '@/layouts/auth/auth-simple-layout';

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
}) {
    const { t } = useTrans();

    return (
        <div className="relative">
            <div className="absolute top-4 right-4 z-10">
                <LanguageSwitcher />
            </div>
            <AuthLayoutTemplate title={t(title)} description={t(description)}>
                {children}
            </AuthLayoutTemplate>
        </div>
    );
}
