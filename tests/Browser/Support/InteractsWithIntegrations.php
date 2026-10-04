<?php

namespace Tests\Browser\Support;

/**
 * The team integrations page is one card with a row per provider: a status line, a button that
 * opens the provider in a sheet (details, panels and actions) and a switch that asks to disconnect.
 */
trait InteractsWithIntegrations
{
    protected function integrationRow(string $provider): string
    {
        return "[data-test=\"integration-card-{$provider}\"]";
    }

    protected function integrationPanel(string $provider): string
    {
        return "[data-test=\"integration-panel-{$provider}\"]";
    }

    /**
     * The sheet of a provider is a dialog too: a confirmation or a form opened over it is the dialog that is not a sheet.
     */
    protected function dialogOverPanel(): string
    {
        return '[role="dialog"][data-slot="dialog-content"]';
    }

    /**
     * The status line reads "<status> · <what is connected>": the status is its first part.
     */
    protected function assertIntegrationStatus(mixed $page, string $provider, string $status): mixed
    {
        $statusLine = json_encode("{$this->integrationRow($provider)} [data-slot=\"provider-row-status\"]", JSON_THROW_ON_ERROR);

        $page->assertScript("document.querySelector({$statusLine})?.textContent.split(' · ')[0] ?? null", $status);

        return $page;
    }

    protected function openIntegration(mixed $page, string $provider): mixed
    {
        $page->click("{$this->integrationRow($provider)} [data-slot=\"provider-row-configure\"]")
            ->assertVisible($this->integrationPanel($provider));

        return $page;
    }

    protected function closeIntegration(mixed $page, string $provider): mixed
    {
        $page->keys($this->integrationPanel($provider), 'Escape')
            ->assertNotPresent($this->integrationPanel($provider));

        return $page;
    }

    /**
     * Turns the switch of a working connection off and confirms the disconnection it asks for.
     */
    protected function disconnectIntegration(mixed $page, string $provider, string $label): mixed
    {
        $page->click("{$this->integrationRow($provider)} [role=\"switch\"]")
            ->assertSeeIn($this->dialogOverPanel(), "Disconnect {$label}?")
            ->click("{$this->dialogOverPanel()} button:has-text(\"Disconnect\")")
            ->assertSee("{$label} disconnected.")
            ->assertNotPresent($this->dialogOverPanel());

        return $page;
    }
}
