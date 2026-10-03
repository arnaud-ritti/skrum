import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    gameBrowseApi,
    importTerms,
    selectionLabel,
    teamBrowseApi,
    toggleAll,
} from '@/lib/poker/tracker-browse';
import type { TrackerIssuePreview } from '@/lib/poker/types';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

function issue(
    externalId: string,
    alreadyImported = false,
): TrackerIssuePreview {
    return {
        externalId,
        key: `PROJ-${externalId}`,
        title: `Story ${externalId}`,
        assignee: null,
        estimate: null,
        status: null,
        alreadyImported,
    };
}

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue(null);
});

describe('importTerms', () => {
    it('names the board and the sprint the way each tracker does', () => {
        expect(importTerms('jira', t).container).toBe('Board');
        expect(importTerms('jira_dc', t).iteration).toBe('Sprint');
        expect(importTerms('github', t).container).toBe('Repository');
        expect(importTerms('github', t).iteration).toBe('Milestone');
        expect(importTerms('linear', t).container).toBe('Team');
        expect(importTerms('linear', t).iteration).toBe('Cycle');
    });
});

describe('selectionLabel', () => {
    it('counts the chosen tickets among the importable ones', () => {
        expect(selectionLabel(9, 12, t)).toBe('9 of 12 selected');
    });
});

describe('toggleAll', () => {
    it('selects every ticket not imported yet, in the list order', () => {
        expect(
            toggleAll([issue('1'), issue('2', true), issue('3')], ['3']),
        ).toEqual(['1', '3']);
    });

    it('selects none when every importable ticket is selected', () => {
        expect(
            toggleAll([issue('1'), issue('2', true), issue('3')], ['3', '1']),
        ).toEqual([]);
    });

    it('selects none when nothing can be imported', () => {
        expect(toggleAll([issue('1', true)], [])).toEqual([]);
    });
});

describe('the browse APIs', () => {
    it('asks the routes of the game', async () => {
        const api = gameBrowseApi('game-1');

        await api.containers('jira', 'web', 1);
        await api.iterations('jira', '7');
        await api.preview('jira', { mode: 'iteration', iteration_id: '31' });

        expect(mocks.request.mock.calls.map((call) => call[0].url)).toEqual([
            '/poker/game-1/imports/jira/containers?q=web&page=1',
            '/poker/game-1/imports/jira/iterations?container=7',
            '/poker/game-1/imports/jira/preview',
        ]);
        expect(mocks.request.mock.calls[2][1]).toEqual({
            mode: 'iteration',
            iteration_id: '31',
        });
    });

    it('asks the routes of the team, before any game exists', async () => {
        const api = teamBrowseApi('acme', 't1');

        await api.containers('linear', '', 2);
        await api.iterations('linear', 'eng');
        await api.preview('linear', {
            mode: 'query',
            query: 'login',
            container: undefined,
        });

        expect(mocks.request.mock.calls.map((call) => call[0].url)).toEqual([
            '/w/acme/teams/t1/poker-imports/linear/containers?q=&page=2',
            '/w/acme/teams/t1/poker-imports/linear/iterations?container=eng',
            '/w/acme/teams/t1/poker-imports/linear/preview',
        ]);
        expect(mocks.request.mock.calls[2][0].method).toBe('post');
    });
});
