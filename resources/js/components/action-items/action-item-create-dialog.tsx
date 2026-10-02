import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import {
    newItemToPayload,
    ownerOptions,
} from '@/components/action-items/action-item-adapters';
import type { NewActionItem } from '@/components/action-items/action-item-adapters';
import { ItemCreateForm } from '@/components/action-items/item-create-form';
import type { RunMutation } from '@/components/action-items/use-action-item-mutations';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';

export type ActionItemTeam = {
    id: string;
    name: string;
    members: { id: string; name: string; avatarUrl: string }[];
};

type ButtonProps = {
    onClick: () => void;
    /** Place of "Export", before the button (AI-4). */
    before?: ReactNode;
};

/** The action of the page, in the topbar: on a phone its icon alone. */
export function NewActionItemButton({ onClick, before }: ButtonProps) {
    const { t } = useTrans();

    return (
        <>
            {before}
            <Button
                type="button"
                data-slot="new-action-item"
                aria-haspopup="dialog"
                className="max-w-full min-w-0 shrink-0"
                onClick={onClick}
            >
                <Plus aria-hidden />
                <span className="truncate max-sm:sr-only">
                    {t('New action item')}
                </span>
            </Button>
        </>
    );
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceSlug: string;
    /** The teams the viewer belongs to: only a member adds an item to a team. */
    teams: ActionItemTeam[];
    /** The team of the filter, chosen first when the viewer belongs to it. */
    defaultTeamId: string | null;
    run: RunMutation;
    onCreated: (item: ActionItem) => void;
};

/** An action item added outside a retro, to one of the viewer's teams. */
export function ActionItemCreateDialog({
    open,
    onOpenChange,
    workspaceSlug,
    teams,
    defaultTeamId,
    run,
    onCreated,
}: Props) {
    const { t } = useTrans();
    const restoreFocus = useRestoreFocus(open);
    const [teamId, setTeamId] = useState(
        teams.some((team) => team.id === defaultTeamId)
            ? (defaultTeamId as string)
            : (teams[0]?.id ?? ''),
    );
    const team = teams.find((option) => option.id === teamId);

    const create = async (values: NewActionItem): Promise<boolean> => {
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                WorkspaceActionItemsController.store(workspaceSlug),
                { ...newItemToPayload(values), team_id: teamId },
            ),
        );

        if (!response) {
            return false;
        }

        onCreated(response.actionItem);
        onOpenChange(false);

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-slot="action-item-create"
                onCloseAutoFocus={restoreFocus}
            >
                <DialogHeader>
                    <DialogTitle>{t('New action item')}</DialogTitle>
                    <DialogDescription>
                        {t('Add a follow-up to one of your teams.')}
                    </DialogDescription>
                </DialogHeader>
                <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger className="w-full" aria-label={t('Team')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {teams.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <ItemCreateForm
                    key={teamId}
                    members={ownerOptions(team?.members ?? [])}
                    onCreate={create}
                />
            </DialogContent>
        </Dialog>
    );
}
