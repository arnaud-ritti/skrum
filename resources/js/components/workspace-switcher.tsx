import { Link, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { useTrans } from '@/hooks/use-trans';

export function WorkspaceSwitcher() {
    const { workspaces, currentWorkspace } = usePage().props;
    const { t } = useTrans();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="justify-between">
                    <span className="truncate">
                        {currentWorkspace?.name ?? t('Select a workspace')}
                    </span>
                    <ChevronsUpDown className="size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {workspaces.map((workspace) => (
                    <DropdownMenuItem key={workspace.id} asChild>
                        <Link href={WorkspacesController.show(workspace.slug)}>
                            <span className="flex-1 truncate">
                                {workspace.name}
                            </span>
                            {workspace.id === currentWorkspace?.id && (
                                <Check className="size-4" />
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={WorkspacesController.create()}>
                        <Plus className="size-4" />
                        {t('New workspace')}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
