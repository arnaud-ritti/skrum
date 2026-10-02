<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_redirects_a_guest_to_the_login_page(): void
    {
        $response = $this->get(route('home'));

        $response->assertRedirect(route('login'));
    }
}
