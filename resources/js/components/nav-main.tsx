import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';
import { useTrans } from '@/hooks/use-trans';

export function NavMain({ items }: { items: NavItem[] }) {
    const { isCurrentUrl } = useCurrentUrl();
    const { t } = useTrans();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{t('Platform')}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={isCurrentUrl(item.href)}
                            tooltip={{ children: t(item.title) }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{t(item.title)}</span>
                            </Link>
                        </SidebarMenuButton>
                        {item.badge !== undefined && item.badge > 0 && (
                            <SidebarMenuBadge
                                className="bg-red-600 text-white peer-hover/menu-button:text-white"
                                aria-label={t(':count overdue', {
                                    count: item.badge,
                                })}
                            >
                                {item.badge > 99 ? '99+' : item.badge}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
