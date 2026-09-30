import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import SurveyClosuresController from '@/actions/App/Http/Controllers/Retros/SurveyClosuresController';
import SurveysController from '@/actions/App/Http/Controllers/Retros/SurveysController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { SurveyPhases } from '@/lib/retro/survey-api';
import type { SurveyPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { SurveyDialog } from './survey-dialog';

export function SurveyMenu({ survey }: { survey: SurveyPayload }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const { retro, viewer } = ctx.board;

    if (!viewer.isFacilitator || retro.phase === 'completed') {
        return null;
    }

    const canEdit = ctx.isEditable && SurveyPhases.includes(retro.phase);
    const route = { retro: retro.id, survey: survey.id };

    const send = async (request: Promise<{ survey: SurveyPayload }>) => {
        setBusy(true);

        const response = await ctx.run(request).finally(() => setBusy(false));

        if (response) {
            ctx.apply({ type: 'survey.upsert', survey: response.survey });
        }
    };

    const destroy = async () => {
        setBusy(true);

        const result = await ctx
            .run(retroRequest(SurveysController.destroy(route)))
            .finally(() => setBusy(false));

        if (result === undefined) {
            return;
        }

        setConfirmingDelete(false);
        ctx.apply({ type: 'survey.remove', surveyId: survey.id });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={t('Survey actions')}
                        disabled={busy}
                    >
                        <Ellipsis className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        disabled={!canEdit || survey.responseCount > 0}
                        onSelect={() => setEditing(true)}
                    >
                        {t('Edit survey')}
                    </DropdownMenuItem>
                    {survey.responseCount > 0 && (
                        <p className="px-2 pb-1 text-xs text-muted-foreground">
                            {t(
                                'Edit is only possible before the first answer.',
                            )}
                        </p>
                    )}
                    <DropdownMenuCheckboxItem
                        checked={survey.showVoters}
                        disabled={retro.isAnonymous}
                        onCheckedChange={(checked) =>
                            void send(
                                retroRequest<{ survey: SurveyPayload }>(
                                    SurveysController.update(route),
                                    { show_voters: checked === true },
                                ),
                            )
                        }
                    >
                        {t('Show who answered')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem
                        onSelect={() =>
                            void send(
                                retroRequest<{ survey: SurveyPayload }>(
                                    survey.isClosed
                                        ? SurveyClosuresController.destroy(
                                              route,
                                          )
                                        : SurveyClosuresController.update(
                                              route,
                                          ),
                                ),
                            )
                        }
                    >
                        {survey.isClosed
                            ? t('Reopen survey')
                            : t('Close survey')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={!canEdit}
                        onSelect={() => setConfirmingDelete(true)}
                    >
                        {t('Delete survey')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <SurveyDialog
                open={editing && !ctx.sessionExpired}
                onOpenChange={setEditing}
                survey={survey}
            />
            <Dialog
                open={confirmingDelete && !ctx.sessionExpired}
                onOpenChange={setConfirmingDelete}
            >
                <DialogContent>
                    <DialogTitle>{t('Delete this survey?')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'Its answers, reactions and comments are deleted too.',
                        )}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDelete(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void destroy()}
                        >
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
