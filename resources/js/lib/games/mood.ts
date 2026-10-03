import { Cloud, CloudLightning, CloudRain, CloudSun, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GameWeather } from './types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

/** The fewest picks that show the weather (`MoodWeatherRules::Threshold`, decision 8). */
export const MoodThreshold = 3;

/** In the order of `GameWeather` on the server, from the brightest. */
export const MoodWeathers: { value: GameWeather; icon: LucideIcon }[] = [
    { value: 'sunny', icon: Sun },
    { value: 'partly_cloudy', icon: CloudSun },
    { value: 'cloudy', icon: Cloud },
    { value: 'rainy', icon: CloudRain },
    { value: 'stormy', icon: CloudLightning },
];

export function weatherLabel(weather: GameWeather, t: Translate): string {
    switch (weather) {
        case 'sunny':
            return t('Sunny');
        case 'partly_cloudy':
            return t('Some clouds');
        case 'cloudy':
            return t('Cloudy');
        case 'rainy':
            return t('Rainy');
        case 'stormy':
            return t('Stormy');
    }
}
