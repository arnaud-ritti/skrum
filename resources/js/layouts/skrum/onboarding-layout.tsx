import { Link, router, usePage } from '@inertiajs/react';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OnboardingFrame } from '@/components/skrum/frames';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { logout } from '@/routes';

export default function OnboardingLayout({
    stepper,
    progress,
    aside,
    children,
}: {
    stepper?: ReactNode;
    progress?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const { brand, auth } = usePage().props;
    const { t } = useTrans();
    const user = auth?.user;

    return (
        <OnboardingFrame
            brand={brand}
            stepper={stepper}
            progress={progress}
            aside={aside}
            headerEnd={
                <div className="flex shrink-0 items-center gap-2">
                    <LanguageSwitcher className="w-32 md:w-40" />
                    {user !== undefined && (
                        <>
                            <PersonAvatar
                                name={user.name}
                                src={user.avatarUrl}
                                size="sm"
                                className="max-md:hidden"
                            />
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="max-md:px-2"
                            >
                                <Link
                                    href={logout()}
                                    as="button"
                                    onClick={() => router.flushAll()}
                                    data-test="logout-button"
                                >
                                    <LogOut aria-hidden="true" />
                                    <span className="max-md:sr-only">
                                        {t('Log out')}
                                    </span>
                                </Link>
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            {children}
        </OnboardingFrame>
    );
}
