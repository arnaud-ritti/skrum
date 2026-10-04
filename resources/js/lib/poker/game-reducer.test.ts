import { describe, expect, it } from 'vitest';
import { gameReducer } from '@/lib/poker/game-reducer';
import { pokerSnapshot, pokerTask } from '@/test/poker-room';

describe('gameReducer, tasks.reorder', () => {
    it('lists a task named twice in the order only once', () => {
        const next = gameReducer(
            pokerSnapshot({
                tasks: [
                    pokerTask('a', 'Login', { position: 1 }),
                    pokerTask('b', 'Signup', { position: 2 }),
                ],
            }),
            { type: 'tasks.reorder', taskIds: ['b', 'a', 'b'] },
        );

        expect(next.tasks.map((task) => [task.id, task.position])).toEqual([
            ['b', 1],
            ['a', 2],
        ]);
    });
});
