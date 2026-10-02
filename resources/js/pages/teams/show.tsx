import { Form, Head, Link } from '@inertiajs/react';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import RetrosController from '@/actions/App/Http/Controllers/Retros/RetrosController';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { HealthStatementsSection } from '@/components/teams/health-statements-section';
import { NewRetroDialog } from '@/components/teams/new-retro-dialog';
import { PokerGamesSection } from '@/components/teams/poker-games-section';
import { WhiteboardsSection } from '@/components/teams/whiteboards-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    CatalogueTemplate,
    CategoryOption,
    GameOption,
    LlmAvailability,
    MemberSummary,
    PokerDeckOption,
    PokerGameSummary,
    RetroSummary,
    TeamHealthStatement,
    TeamSummary,
    WhiteboardGalleryItem,
    WhiteboardSummary,
    WhiteboardTemplateSummary,
    WorkspaceSummary,
    SavedPokerDeck,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    members: MemberSummary[];
    availableMembers: MemberSummary[];
    canManage: boolean;
    openActionItemCount: number;
    retros: RetroSummary[];
    templateCategories: CategoryOption[];
    topTemplates: string[];
    catalogue?: CatalogueTemplate[];
    canCreateRetro: boolean;
    healthStatements: TeamHealthStatement[];
    canManageHealthStatements: boolean;
    llm: LlmAvailability;
    icebreakerGames: GameOption[];
    pokerGames: PokerGameSummary[];
    pokerDeckOptions: PokerDeckOption[];
    canCreatePokerGame: boolean;
    canManageIntegrations: boolean;
    pokerDecks: SavedPokerDeck[];
    whiteboards: WhiteboardSummary[];
    canCreateWhiteboard: boolean;
    whiteboardTemplates: WhiteboardTemplateSummary[];
    whiteboardGallery?: WhiteboardGalleryItem[];
};

export default function ShowTeam({
    workspace,
    team,
    members,
    availableMembers,
    canManage,
    openActionItemCount,
    retros,
    templateCategories,
    catalogue,
    canCreateRetro,
    healthStatements,
    canManageHealthStatements,
    llm,
    icebreakerGames,
    pokerGames,
    pokerDeckOptions,
    canCreatePokerGame,
    canManageIntegrations,
    pokerDecks,
    whiteboards,
    canCreateWhiteboard,
    whiteboardTemplates,
    whiteboardGallery,
}: Props) {
    const { t } = useTrans();
    const params = { workspace: workspace.slug, team: team.id };

    return (
        <>
            <Head title={team.name} />
            <div className="max-w-2xl space-y-8 p-4">
                <Heading
                    title={team.name}
                    description={t('Retrospectives of this team')}
                />

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={WorkspaceActionItemsController.index(
                                workspace.slug,
                                { query: { team: team.id } },
                            )}
                        >
                            {t('Open action items (:count)', {
                                count: openActionItemCount,
                            })}
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={TeamGameRoomsController.index(params)}>
                            {t('Games')}
                        </Link>
                    </Button>
                    {canManageIntegrations && (
                        <Button variant="outline" size="sm" asChild>
                            <Link
                                href={TeamIntegrationsController.index(params)}
                            >
                                {t('Integrations')}
                            </Link>
                        </Button>
                    )}
                </div>

                {canManage && (
                    <Form
                        {...TeamsController.update.form(params)}
                        className="flex items-start gap-2"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="flex-1">
                                    <Input
                                        name="name"
                                        defaultValue={team.name}
                                        required
                                        maxLength={100}
                                        aria-label={t('Team name')}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <Button variant="outline" disabled={processing}>
                                    {t('Rename')}
                                </Button>
                            </>
                        )}
                    </Form>
                )}

                <section className="space-y-3">
                    <Heading variant="small" title={t('Retrospectives')} />

                    {canCreateRetro && (
                        <NewRetroDialog
                            workspaceSlug={workspace.slug}
                            teamId={team.id}
                            categories={templateCategories}
                            catalogue={catalogue}
                            llm={llm}
                            icebreakerGames={icebreakerGames}
                        />
                    )}

                    {retros.length === 0 && (
                        <p className="text-muted-foreground">
                            {t('No retrospectives yet.')}
                        </p>
                    )}

                    <ul className="divide-y rounded-md border">
                        {retros.map((retro) => (
                            <li key={retro.id}>
                                <Link
                                    href={RetrosController.show(retro.id)}
                                    className="flex items-center justify-between p-3 hover:bg-muted"
                                >
                                    <span className="font-medium">
                                        {retro.title}
                                    </span>
                                    <Badge variant="secondary">
                                        {retro.phaseLabel}
                                    </Badge>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                <PokerGamesSection
                    workspaceSlug={workspace.slug}
                    teamId={team.id}
                    games={pokerGames}
                    deckOptions={pokerDeckOptions}
                    savedDecks={pokerDecks}
                    canCreate={canCreatePokerGame}
                />
                <WhiteboardsSection
                    workspaceSlug={workspace.slug}
                    teamId={team.id}
                    boards={whiteboards}
                    canCreate={canCreateWhiteboard}
                    templates={whiteboardTemplates}
                    gallery={whiteboardGallery}
                />
                <HealthStatementsSection
                    statements={healthStatements}
                    canManage={canManageHealthStatements}
                    params={params}
                />

                <section className="space-y-3">
                    <Heading variant="small" title={t('Members')} />
                    <ul className="divide-y rounded-md border">
                        {members.map((member) => (
                            <li
                                key={member.id}
                                className="flex items-center justify-between p-3"
                            >
                                <div>
                                    <div className="font-medium">
                                        {member.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {member.email}
                                    </div>
                                </div>
                                {canManage && (
                                    <Form
                                        {...TeamMembersController.destroy.form({
                                            ...params,
                                            member: member.id,
                                        })}
                                    >
                                        {({ processing }) => (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={processing}
                                            >
                                                {t('Remove')}
                                            </Button>
                                        )}
                                    </Form>
                                )}
                            </li>
                        ))}
                    </ul>

                    {canManage && availableMembers.length > 0 && (
                        <Form
                            {...TeamMembersController.store.form(params)}
                            className="flex items-start gap-2"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="flex-1">
                                        <Select name="user_id">
                                            <SelectTrigger
                                                aria-label={t('Add a member')}
                                            >
                                                <SelectValue
                                                    placeholder={t(
                                                        'Add a member',
                                                    )}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableMembers.map(
                                                    (member) => (
                                                        <SelectItem
                                                            key={member.id}
                                                            value={member.id}
                                                        >
                                                            {member.name}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.user_id} />
                                    </div>
                                    <Button disabled={processing}>
                                        {t('Add')}
                                    </Button>
                                </>
                            )}
                        </Form>
                    )}
                </section>

                {canManage && (
                    <ConfirmFormDialog
                        form={TeamsController.destroy.form(params)}
                        title={t('Delete this team?')}
                        description={t(
                            'This permanently deletes the team and its retrospectives.',
                        )}
                        confirmLabel={t('Delete team')}
                        trigger={
                            <Button variant="destructive">
                                {t('Delete team')}
                            </Button>
                        }
                    />
                )}
            </div>
        </>
    );
}
