<?php

namespace App\Enums;

enum LlmProvider: string
{
    case Anthropic = 'anthropic';
    case OpenAi = 'openai';
    case OpenAiCompatible = 'openai-compatible';
    case Gemini = 'gemini';
    case Azure = 'azure';
    case Bedrock = 'bedrock';
    case Groq = 'groq';
    case Xai = 'xai';
    case DeepSeek = 'deepseek';
    case Mistral = 'mistral';
    case Ollama = 'ollama';
    case OpenRouter = 'openrouter';

    public function label(): string
    {
        return match ($this) {
            self::Anthropic => 'Anthropic',
            self::OpenAi => 'OpenAI',
            self::OpenAiCompatible => 'OpenAI compatible',
            self::Gemini => 'Gemini',
            self::Azure => 'Azure OpenAI',
            self::Bedrock => 'Amazon Bedrock',
            self::Groq => 'Groq',
            self::Xai => 'xAI',
            self::DeepSeek => 'DeepSeek',
            self::Mistral => 'Mistral',
            self::Ollama => 'Ollama',
            self::OpenRouter => 'OpenRouter',
        };
    }

    public function requiresKey(): bool
    {
        return ! in_array($this, [self::OpenAiCompatible, self::Ollama, self::Bedrock], true);
    }
}
