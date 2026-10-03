import { describe, expect, it } from 'vitest';
import {
    taskTimerFromChoice,
    taskTimerChoice,
    taskTimerOptions,
    writeBackChoice,
    writeBackOptions,
    writeBackPayload,
    writableSource,
} from './game-options';
import type { WriteBackTarget } from './game-options';

const t = (key: string, replace: Record<string, string | number> = {}) =>
    Object.entries(replace).reduce(
        (text, [name, value]) => text.replace(`:${name}`, String(value)),
        key,
    );

const jira: WriteBackTarget = {
    source: 'jira',
    estimateFields: [
        { id: 'customfield_10016', name: 'Story point estimate' },
        { id: 'customfield_10020', name: 'Size' },
    ],
    defaultEstimateFieldId: 'customfield_10016',
};

const linear: WriteBackTarget = {
    source: 'linear',
    estimateFields: [],
    defaultEstimateFieldId: null,
};

describe('the task timer', () => {
    it('offers Off and 1, 3, 5, 10 minutes', () => {
        expect(taskTimerOptions(t)).toEqual([
            { value: 'off', label: 'Off' },
            { value: '60', label: '1 minute' },
            { value: '180', label: '3 minutes' },
            { value: '300', label: '5 minutes' },
            { value: '600', label: '10 minutes' },
        ]);
    });

    it('turns a choice into seconds and back', () => {
        expect(taskTimerFromChoice('off')).toBeNull();
        expect(taskTimerFromChoice('180')).toBe(180);
        expect(taskTimerFromChoice('120')).toBeNull();
        expect(taskTimerChoice(null)).toBe('off');
        expect(taskTimerChoice(600)).toBe('600');
    });
});

describe('the write-back', () => {
    it('lists the Jira fields after "Don\'t write"', () => {
        expect(writeBackOptions(jira, t)).toEqual([
            { value: 'none', label: "Don't write" },
            { value: 'customfield_10016', label: 'Story point estimate' },
            { value: 'customfield_10020', label: 'Size' },
        ]);
    });

    it('has only "Write" and "Don\'t write" for a source without fields', () => {
        expect(writeBackOptions(linear, t)).toEqual([
            { value: 'none', label: "Don't write" },
            { value: 'write', label: 'Write' },
        ]);
    });

    it('reads the game: off, the chosen field, the connection field by default', () => {
        expect(writeBackChoice(jira, false, 'customfield_10020')).toBe('none');
        expect(writeBackChoice(jira, true, 'customfield_10020')).toBe(
            'customfield_10020',
        );
        expect(writeBackChoice(jira, true, null)).toBe('customfield_10016');
        expect(
            writeBackChoice(
                { ...jira, defaultEstimateFieldId: null },
                true,
                null,
            ),
        ).toBe('customfield_10016');
        expect(writeBackChoice(linear, true, null)).toBe('write');
    });

    it('sends the switch and the field', () => {
        expect(writeBackPayload('none')).toEqual({
            writes_estimates: false,
            estimate_field_id: null,
        });
        expect(writeBackPayload('write')).toEqual({
            writes_estimates: true,
            estimate_field_id: null,
        });
        expect(writeBackPayload('customfield_10020')).toEqual({
            writes_estimates: true,
            estimate_field_id: 'customfield_10020',
        });
    });

    it('picks the first source that can write back', () => {
        expect(
            writableSource([
                { ...linear, canWriteBack: false },
                { ...jira, canWriteBack: true },
            ])?.source,
        ).toBe('jira');
        expect(writableSource([{ ...linear, canWriteBack: false }])).toBeNull();
    });
});
