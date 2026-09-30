<?php

namespace App\Mcp\Tools\Poker;

use App\Actions\Poker\CreatePokerGame;
use App\Actions\Poker\NewPokerGame;
use App\Actions\Poker\PokerDeckRules;
use App\Actions\Poker\SavedPokerDeckRules;
use App\Enums\McpScope;
use App\Enums\PokerDeck;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpPokerGame;
use App\Mcp\Tools\SkrumTool;
use App\Models\PokerPlayer;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly(false)]
#[IsOpenWorld(false)]
class CreateGame extends SkrumTool
{
    protected string $name = 'poker.games.create';

    protected string $description = 'Create a planning poker game for a team with a deck (fibonacci, modified_fibonacci, tshirt, powers_of_two, or custom with custom_cards, or a saved deck of the team with saved_deck_id). You become its facilitator. Guest access, auto-reveal and anonymous votes stay off.';

    public function __construct(
        private McpContext $context,
        private CreatePokerGame $createPokerGame,
        private McpPokerGame $presentGame,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'team_id' => $schema->string()->format('uuid')->required(),
            'title' => $schema->string()->min(1)->max(120)->required(),
            'deck' => $schema->string()->enum(array_column(PokerDeck::cases(), 'value'))->required(),
            'custom_cards' => $schema->array()->items($schema->string()->min(1)->max(8))->min(2)->max(20)->description('Cards of a custom deck, in order.'),
            'include_unknown' => $schema->boolean()->default(true)->description('Append the "?" card to a custom deck.'),
            'include_coffee' => $schema->boolean()->default(true)->description('Append the "☕" card to a custom deck.'),
            'saved_deck_id' => $schema->string()->format('uuid')->description('A saved deck of the same team (with deck "custom"); exclusive with custom_cards.'),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Write;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $team = $this->context->team((string) $request->validate(['team_id' => ['required', 'uuid']])['team_id']);

        SavedPokerDeckRules::ensureExclusive($request->all());

        $usesSavedDeck = $request->get('saved_deck_id') !== null;

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            ...($usesSavedDeck
                ? ['deck' => ['required', Rule::in([PokerDeck::Custom->value])], 'saved_deck_id' => ['required', 'string']]
                : PokerDeckRules::rules()),
        ]);

        if ($usesSavedDeck) {
            $savedDeck = SavedPokerDeckRules::findForTeam($team, (string) $validated['saved_deck_id']);
            [$deck, $cards, $deckName] = [PokerDeck::Custom, $savedDeck->cards, $savedDeck->name];
        } else {
            [$deck, $cards] = PokerDeckRules::resolve($validated);
            $deckName = null;
        }

        $game = $this->createPokerGame->handle($team, McpGrant::current()->user, new NewPokerGame(
            title: $validated['title'],
            deck: $deck,
            cards: $cards,
            deckName: $deckName,
        ));

        $player = PokerPlayer::query()->whereKey($game->facilitator_player_id)->firstOrFail();

        return Response::structured($this->presentGame->game($game->fresh() ?? $game, $player));
    }
}
