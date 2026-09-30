<?php

namespace App\Mcp\Prompts;

use App\Enums\McpScope;
use App\Mcp\McpGrant;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Prompt;

abstract class SkrumPrompt extends Prompt
{
    public const MaxContentLength = 60000;

    private const Languages = ['en' => 'English', 'fr' => 'French', 'es' => 'Spanish', 'de' => 'German'];

    public function shouldRegister(): bool
    {
        return McpGrant::current()->has(McpScope::Read);
    }

    /**
     * Runs a read tool as the current grant, so the prompt carries exactly
     * what the tool would return, with the same redaction.
     *
     * @param  class-string  $toolClass
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    protected function toolData(string $toolClass, array $arguments): array
    {
        $result = app($toolClass)->handle(new Request($arguments));

        if ($result instanceof Response) {
            throw new PromptToolFailed((string) $result->content());
        }

        if ($result instanceof ResponseFactory) {
            $error = $result->responses()->first(fn (Response $response): bool => $response->isError());

            if ($error !== null) {
                throw new PromptToolFailed((string) $error->content());
            }
        }

        return $result->getStructuredContent() ?? [];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function message(string $instructions, array $data, ?string $note = null): Response
    {
        $language = self::Languages[McpGrant::current()->user->locale ?? 'en'] ?? 'English';
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

        $text = $instructions."\nAnswer in {$language}.";

        if ($note !== null) {
            $text .= "\n".$note;
        }

        return Response::text($text."\n\n```json\n".$json."\n```");
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected static function length(array $data): int
    {
        return mb_strlen((string) json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
