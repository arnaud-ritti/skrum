<?php

it('redirects a guest from the home page to the login page', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});
