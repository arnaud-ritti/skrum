import { screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    EmptyExportTarget,
    ExportTargetFields,
    exportTargetBody,
    exportTargetComplete,
} from '@/components/action-items/export-target-fields';
import type { ExportTarget } from '@/components/action-items/export-target-fields';
import { renderWithProviders } from '@/test/render';
import type { ExportSource } from '@/types/integrations';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-2',
};

function Harness({
    onReady,
    onTarget,
}: {
    onReady: (ready: boolean) => void;
    onTarget: (target: ExportTarget) => void;
}) {
    const [target, setTarget] = useState<ExportTarget>(EmptyExportTarget);

    return (
        <ExportTargetFields
            source={jira}
            scope={{ workspace: 'acme', canManagePeople: false }}
            teamId="team-1"
            value={target}
            onChange={(next) => {
                onTarget(next);
                setTarget(next);
            }}
            onReadyChange={onReady}
        />
    );
}

describe('ExportTargetFields', () => {
    it("starts from the team's last choice and says when the target is complete", async () => {
        retroRequest.mockResolvedValue({
            projects: [{ id: 'p1', key: 'PROJ', name: 'Project' }],
            issueTypes: [{ id: 't1', name: 'Task' }],
            defaults: { projectId: 'p1', issueTypeId: 't1' },
        });
        const onReady = vi.fn();
        const onTarget = vi.fn();

        renderWithProviders(<Harness onReady={onReady} onTarget={onTarget} />);

        expect(
            (await screen.findByRole('combobox', { name: 'Project' }))
                .textContent,
        ).toContain('PROJ — Project');
        await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
        expect(onTarget).toHaveBeenCalledWith({
            projectId: 'p1',
            issueTypeId: 't1',
            teamId: null,
            repositoryId: null,
        });
        expect(retroRequest.mock.calls[0][0].url).toContain('/teams/team-1/');
    });
});

describe('exportTargetBody', () => {
    const target: ExportTarget = {
        projectId: 'p1',
        issueTypeId: 't1',
        teamId: 'l1',
        repositoryId: 'r1',
    };

    it('sends what each tracker asks for', () => {
        expect(exportTargetBody('jira_dc', target)).toEqual({
            source: 'jira_dc',
            project_id: 'p1',
            issue_type_id: 't1',
        });
        expect(exportTargetBody('linear', target)).toEqual({
            source: 'linear',
            team_id: 'l1',
        });
        expect(exportTargetBody('github', target)).toEqual({
            source: 'github',
            repository_id: 'r1',
        });
    });

    it('needs both the project and the issue type for Jira', () => {
        expect(
            exportTargetComplete('jira', { ...target, issueTypeId: null }),
        ).toBe(false);
        expect(exportTargetComplete('linear', EmptyExportTarget)).toBe(false);
        expect(exportTargetComplete('github', target)).toBe(true);
    });
});
