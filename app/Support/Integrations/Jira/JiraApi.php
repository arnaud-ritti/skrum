<?php

namespace App\Support\Integrations\Jira;

use App\Models\TeamIntegration;

/**
 * Jira Cloud (REST v3) and Jira Server/Data Center (REST v2) behind one
 * surface; token handling, reconnect states and error mapping stay in each
 * client.
 */
interface JiraApi
{
    /**
     * @param  array<string, mixed>  $query
     * @return array<array-key, mixed>
     */
    public function get(TeamIntegration $integration, string $path, array $query = []): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function post(TeamIntegration $integration, string $path, array $body = []): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function put(TeamIntegration $integration, string $path, array $body = []): array;

    /**
     * @param  array<string, mixed>  $body
     * @return array<array-key, mixed>
     */
    public function delete(TeamIntegration $integration, string $path, array $body = []): array;

    /**
     * `rest/api/3/{resource}` on Cloud, `rest/api/2/{resource}` on Data Center.
     */
    public function apiPath(string $resource): string;

    /**
     * The issue's web page; the key is encoded here.
     */
    public function browseUrl(TeamIntegration $integration, string $key): string;
}
