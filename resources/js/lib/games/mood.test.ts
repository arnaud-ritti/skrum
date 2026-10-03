import { describe, expect, it } from 'vitest';
import { MoodWeathers, weatherLabel } from './mood';

describe('MoodWeathers', () => {
    it('lists the five weathers in the order of the server', () => {
        expect(MoodWeathers.map(({ value }) => value)).toEqual([
            'sunny',
            'partly_cloudy',
            'cloudy',
            'rainy',
            'stormy',
        ]);
    });

    it('labels each weather as the server does', () => {
        const t = (key: string) => key;

        expect(MoodWeathers.map(({ value }) => weatherLabel(value, t))).toEqual(
            ['Sunny', 'Some clouds', 'Cloudy', 'Rainy', 'Stormy'],
        );
    });
});
