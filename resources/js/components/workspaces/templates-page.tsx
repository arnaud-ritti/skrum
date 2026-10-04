import { router } from '@inertiajs/react';
import { Layers, PenTool, Plus, Search, SearchX, Spade, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import type { RetroTemplate } from '@/components/skrum/retro-template-picker';
import type { TemplateDraft } from '@/components/skrum/template-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PokerDecksTab } from '@/components/workspaces/poker-decks-tab';
import {
    RetroTemplateCards,
    RetroTemplatesTab,
} from '@/components/workspaces/retro-templates-tab';
import { TemplatesSection } from '@/components/workspaces/template-card';
import {
    focusedElement,
    templateCardMenu,
    useMenuDialogFocus,
} from '@/components/workspaces/use-menu-dialog-focus';
import { TemplateEditorSheet } from '@/components/workspaces/template-editor-sheet';
import type { TemplateEditorTarget } from '@/components/workspaces/template-editor-sheet';
import { WhiteboardTemplatesTab } from '@/components/workspaces/whiteboard-templates-tab';
import { useTrans } from '@/hooks/use-trans';
import { deleteVisit } from '@/lib/visit';
import type { VisitError } from '@/lib/visit';
import {
    DefaultTemplateCategory,
    blankTemplateDraft,
    copyTemplateName,
    defaultVisibility,
    draftFromTemplate,
    matchesTemplateQuery,
    shareableDraft,
} from '@/lib/workspaces/template-draft';
import { useTemplateHref } from '@/lib/workspaces/use-template';
import type {
    CatalogueTemplate,
    CategoryOption,
    TeamSummary,
    WorkspacePokerDeck,
    WorkspaceSummary,
    WorkspaceTemplateSummary,
    WorkspaceWhiteboardTemplate,
} from '@/types';

export type TemplatesPageProps = {
    workspace: WorkspaceSummary;
    templates: WorkspaceTemplateSummary[];
    categories: CategoryOption[];
    whiteboardTemplates: WorkspaceWhiteboardTemplate[];
    pokerDecks: WorkspacePokerDeck[];
    canCreatePokerDeck: boolean;
    canManage: boolean;
    /** Every member may create a template: a personal one at least. */
    canCreate: boolean;
    /** The viewer may create workspace templates. */
    canShareWorkspace: boolean;
    /** The teams the viewer may create team templates for. */
    teamTemplateTeams: TeamSummary[];
    /** Loaded on demand: the Retro tab and a new template ask for it. */
    catalogue?: CatalogueTemplate[];
};

type TemplatesTab = 'all' | 'retro' | 'poker' | 'whiteboard';

let editorOpenings = 0;

function editorTarget(
    template: WorkspaceTemplateSummary | null,
    draft: TemplateDraft,
): TemplateEditorTarget {
    editorOpenings += 1;

    return { key: `template-editor-${editorOpenings}`, template, draft };
}

export function TemplatesPage({
    workspace,
    templates,
    categories,
    whiteboardTemplates,
    pokerDecks,
    canCreatePokerDeck,
    canCreate,
    canShareWorkspace,
    teamTemplateTeams,
    catalogue,
    initialTab = 'all',
    team,
}: TemplatesPageProps & {
    /** The tab the page opens on; the bench shows each one. */
    initialTab?: TemplatesTab;
    /** Id of the team "Use" leads to, in place of the current team; `null`: none. */
    team?: string | null;
}) {
    const { t } = useTrans();
    const { hrefFor, hasTeam } = useTemplateHref(workspace.slug, team);
    const lastCatalogue = useRef(catalogue);
    const [tab, setTab] = useState<TemplatesTab>(initialTab);
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<TemplateEditorTarget | null>(null);
    const [deleting, setDeleting] = useState<WorkspaceTemplateSummary | null>(
        null,
    );
    const [deleteError, setDeleteError] = useState<string>();
    const {
        fallbackRef: retroHeadingRef,
        openedFrom,
        originRemoved,
    } = useMenuDialogFocus<HTMLHeadingElement>(
        deleting !== null || editor !== null,
    );

    if (catalogue !== undefined) {
        lastCatalogue.current = catalogue;
    }

    const knownCatalogue = catalogue ?? lastCatalogue.current;
    const needsCatalogue = tab === 'retro' || editor?.template === null;

    /** A visit that follows a save drops the optional prop: it is asked again. */
    useEffect(() => {
        if (needsCatalogue && catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [needsCatalogue, catalogue]);

    const categoryLabel = (value: string): string =>
        categories.find((category) => category.value === value)?.label ?? value;
    const filtering = query.trim() !== '';
    const shownTemplates = templates.filter((template) =>
        matchesTemplateQuery(query, [
            template.name,
            categoryLabel(template.category),
            ...template.columns.map((column) => column.title),
        ]),
    );
    const shownDecks = pokerDecks.filter((deck) =>
        matchesTemplateQuery(query, [deck.name, ...deck.cards]),
    );
    const shownBoards = whiteboardTemplates.filter((template) =>
        matchesTemplateQuery(query, [
            template.name,
            template.description ?? '',
        ]),
    );

    const sharing = { canShareWorkspace, teams: teamTemplateTeams };

    const openNew = (): void => {
        openedFrom(focusedElement());
        setEditor(
            editorTarget(null, {
                ...blankTemplateDraft(),
                ...defaultVisibility(sharing),
            }),
        );
    };

    const openedFromMenuOf = (template: WorkspaceTemplateSummary): void =>
        openedFrom(templateCardMenu(`workspace-template-${template.id}`));

    const openCopy = (draft: TemplateDraft): void =>
        setEditor(
            editorTarget(
                null,
                shareableDraft(
                    {
                        ...draft,
                        name: copyTemplateName(
                            t('Copy of :name', { name: draft.name }),
                        ),
                    },
                    sharing,
                ),
            ),
        );

    const actions = canCreate
        ? {
              onEdit: (template: WorkspaceTemplateSummary) => {
                  openedFromMenuOf(template);
                  setEditor(
                      editorTarget(template, draftFromTemplate(template)),
                  );
              },
              onDuplicate: (template: WorkspaceTemplateSummary) => {
                  openedFromMenuOf(template);
                  openCopy(draftFromTemplate(template));
              },
              onDelete: (template: WorkspaceTemplateSummary) => {
                  openedFromMenuOf(template);
                  setDeleteError(undefined);
                  setDeleting(template);
              },
          }
        : undefined;

    const duplicateFromPicker = (source: RetroTemplate): void => {
        openedFrom(focusedElement());
        openCopy(
            draftFromTemplate({
                name: source.name,
                category:
                    categories.find(
                        (category) => category.value === source.category,
                    )?.value ?? DefaultTemplateCategory,
                columns: source.columns.map((column) => ({
                    title: column.title,
                    description: column.description ?? null,
                    color: column.color,
                })),
            }),
        );
    };

    const remove = (template: WorkspaceTemplateSummary): Promise<void> =>
        deleteVisit(
            WorkspaceTemplatesController.destroy.url({
                workspace: workspace.slug,
                template: template.id,
            }),
        ).then(originRemoved, (error: VisitError) => {
            setDeleteError(
                Object.values(error.errors)[0] ??
                    t('Something went wrong. Please try again.'),
            );

            throw error;
        });

    const clearSearch = (): void => setQuery('');

    const noMatch = (
        <EmptyState
            module="retro"
            illustration={false}
            headingLevel="h2"
            title={t('No template matches ":query"', { query: query.trim() })}
            description={t('Try another word.')}
            action={{
                label: t('Clear search'),
                icon: SearchX,
                variant: 'outline',
                onClick: clearSearch,
            }}
        />
    );

    const retroSection = (
        <TemplatesSection
            icon={Layers}
            title={t('Retrospective')}
            hint={t('Columns and colours are copied into the new retro')}
            headingRef={retroHeadingRef}
        >
            {templates.length === 0 ? (
                <div
                    data-slot="retro-templates-empty"
                    className="rounded-xl border border-dashed border-input bg-card/50"
                >
                    <EmptyState
                        module="retro"
                        headingLevel="h3"
                        title={t('No workspace templates yet.')}
                        description={t(
                            'Every team can still start a retro from a built-in template.',
                        )}
                        action={
                            canCreate
                                ? {
                                      label: t('Create a template'),
                                      icon: Plus,
                                      variant: 'outline',
                                      onClick: openNew,
                                  }
                                : undefined
                        }
                    />
                </div>
            ) : (
                <RetroTemplateCards
                    templates={shownTemplates}
                    hrefFor={hrefFor}
                    actions={actions}
                />
            )}
        </TemplatesSection>
    );

    const pokerSection = (
        <PokerDecksTab
            workspace={workspace}
            decks={shownDecks}
            allDecks={pokerDecks}
            canCreate={canCreatePokerDeck}
            hrefFor={hrefFor}
        />
    );

    const whiteboardSection = (
        <WhiteboardTemplatesTab
            workspace={workspace}
            templates={shownBoards}
            total={whiteboardTemplates.length}
            hrefFor={hrefFor}
        />
    );

    const sections = [
        { key: 'retro', matches: shownTemplates.length, node: retroSection },
        { key: 'poker', matches: shownDecks.length, node: pokerSection },
        {
            key: 'whiteboard',
            matches: shownBoards.length,
            node: whiteboardSection,
        },
    ] as const;

    /** While searching, a section without a match gives way; with none left, one message. */
    const visibleSections = sections.filter(
        (section) =>
            (tab === 'all' || tab === section.key) &&
            (!filtering || section.matches > 0),
    );

    const tabs: { value: TemplatesTab; label: string; icon?: typeof Layers }[] =
        [
            { value: 'all', label: t('All') },
            {
                value: 'retro',
                label: `${t('Retro')} · ${templates.length}`,
                icon: Layers,
            },
            {
                value: 'poker',
                label: `${t('Poker')} · ${pokerDecks.length}`,
                icon: Spade,
            },
            {
                value: 'whiteboard',
                label: `${t('Whiteboard')} · ${whiteboardTemplates.length}`,
                icon: PenTool,
            },
        ];

    return (
        <div
            data-slot="workspace-templates-page"
            className="flex w-full min-w-0 flex-col gap-8"
        >
            <header className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading">
                        {t('Templates')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Templates shared by every team of this workspace')}
                    </p>
                </div>
                {canCreate && (
                    <Button
                        type="button"
                        className="max-w-full min-w-0"
                        onClick={openNew}
                    >
                        <Plus aria-hidden />
                        <span className="truncate">{t('New template')}</span>
                    </Button>
                )}
            </header>

            <Tabs
                value={tab}
                onValueChange={setTab}
                className="gap-8"
                data-slot="templates-tabs"
            >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <TabsList aria-label={t('Kind of template')}>
                        {tabs.map((item) => (
                            <TabsTrigger
                                key={item.value}
                                value={item.value}
                                icon={item.icon}
                            >
                                {item.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {tab !== 'retro' && (
                        <div className="relative min-w-0 grow basis-48 sm:max-w-64">
                            <Search
                                aria-hidden
                                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                type="search"
                                value={query}
                                placeholder={t('Search templates…')}
                                aria-label={t('Search templates')}
                                className="px-8 [&::-webkit-search-cancel-button]:hidden"
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                            {query !== '' && (
                                <button
                                    type="button"
                                    aria-label={t('Clear')}
                                    onClick={clearSearch}
                                    className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                                >
                                    <X aria-hidden className="size-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <TabsContent
                    value={tab}
                    data-slot="templates-panel"
                    data-tab={tab}
                    className="flex min-w-0 flex-col gap-8"
                >
                    {tab === 'retro' ? (
                        <RetroTemplatesTab
                            templates={templates}
                            catalogue={knownCatalogue}
                            categories={categories}
                            query={query}
                            onQueryChange={setQuery}
                            hrefFor={hrefFor}
                            hasTeam={hasTeam}
                            onCreate={canCreate ? openNew : undefined}
                            onEdit={actions?.onEdit}
                            onDuplicate={
                                canCreate ? duplicateFromPicker : undefined
                            }
                        />
                    ) : (
                        <>
                            {visibleSections.map((section) => (
                                <div key={section.key} className="contents">
                                    {section.node}
                                </div>
                            ))}
                            {visibleSections.length === 0 && noMatch}
                        </>
                    )}
                </TabsContent>
            </Tabs>

            <TemplateEditorSheet
                workspace={workspace}
                target={editor}
                categories={categories}
                catalogue={knownCatalogue}
                canShareWorkspace={canShareWorkspace}
                teams={teamTemplateTeams}
                onClose={() => setEditor(null)}
                onDuplicate={openCopy}
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(next) => {
                    if (!next) {
                        setDeleting(null);
                        setDeleteError(undefined);
                    }
                }}
                tone="destructive"
                title={t('Delete this template?')}
                description={t(
                    'Retros already created from it are not affected.',
                )}
                confirmLabel={t('Delete template')}
                error={deleteError}
                onConfirm={() =>
                    deleting === null ? Promise.resolve() : remove(deleting)
                }
            />
        </div>
    );
}
