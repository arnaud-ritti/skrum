<?php

namespace App\Enums;

enum GameWeather: string
{
    case Sunny = 'sunny';
    case PartlyCloudy = 'partly_cloudy';
    case Cloudy = 'cloudy';
    case Rainy = 'rainy';
    case Stormy = 'stormy';

    public function label(): string
    {
        return match ($this) {
            self::Sunny => __('Sunny'),
            self::PartlyCloudy => __('Some clouds'),
            self::Cloudy => __('Cloudy'),
            self::Rainy => __('Rainy'),
            self::Stormy => __('Stormy'),
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::Sunny => 'sun',
            self::PartlyCloudy => 'cloud-sun',
            self::Cloudy => 'cloud',
            self::Rainy => 'cloud-rain',
            self::Stormy => 'cloud-lightning',
        };
    }
}
