<?php

namespace App\Enums;

enum IntegrationDeliveryKind: string
{
    case RetroLink = 'retro_link';
    case PokerLink = 'poker_link';
    case RetroResults = 'retro_results';
    case GameRoomLink = 'game_room_link';
}
