<?php

use App\Models\GameRound;
use App\Models\IntegrationDelivery;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

it('leaves the json columns of a round without a database default', function () {
    $defaults = collect(Schema::getColumns('game_rounds'))
        ->whereIn('name', ['revealed_positions', 'picked_letters', 'picked_by', 'clue', 'drawing'])
        ->pluck('default', 'name')
        ->all();

    expect($defaults)->toBe([
        'revealed_positions' => null,
        'picked_letters' => null,
        'picked_by' => null,
        'clue' => null,
        'drawing' => null,
    ]);
});

it('gives a new round its empty lists from the model', function () {
    $round = GameRound::factory()->create()->fresh();

    expect($round->revealed_positions)->toBe([])
        ->and($round->picked_letters)->toBe([])
        ->and($round->clue)->toBe([])
        ->and($round->drawing)->toBe([]);
});

it('keeps a webhook payload of half a megabyte whole', function () {
    $delivery = IntegrationDelivery::factory()->create();
    $content = str_repeat('a', 524_288);

    DB::table('integration_delivery_payloads')->insert([
        'id' => (string) Str::uuid7(),
        'integration_delivery_id' => $delivery->id,
        'message' => $content,
        'request_headers' => $content,
        'request_body' => $content,
        'response_excerpt' => $content,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $stored = DB::table('integration_delivery_payloads')->where('integration_delivery_id', $delivery->id)->first();

    expect(strlen((string) $stored->message))->toBe(524_288)
        ->and(strlen((string) $stored->request_body))->toBe(524_288);
});

it('does not move the expiry of an invitation when another column changes', function () {
    $invitation = WorkspaceInvitation::factory()->create(['expires_at' => now()->addDays(3)->startOfSecond()]);
    $expiresAt = DB::table('workspace_invitations')->where('id', $invitation->id)->value('expires_at');

    $this->travel(2)->hours();
    DB::table('workspace_invitations')->where('id', $invitation->id)->update(['accepted_at' => now()]);

    expect(DB::table('workspace_invitations')->where('id', $invitation->id)->value('expires_at'))->toBe($expiresAt);
});

it('has no index that only one engine could build', function (string $table, string $index) {
    expect(Schema::hasIndex($table, $index))->toBeFalse();
})->with([
    ['workspace_templates', 'workspace_templates_workspace_name_unique'],
    ['whiteboard_templates', 'whiteboard_templates_workspace_name_unique'],
    ['poker_decks', 'poker_decks_team_name_unique'],
    ['poker_decks', 'poker_decks_workspace_name_unique'],
]);
