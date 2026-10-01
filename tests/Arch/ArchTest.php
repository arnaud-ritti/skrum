<?php

arch()->preset()->php();

arch()->preset()->security();

arch('actions do not use the http layer')
    ->expect('App\Http')
    ->not->toBeUsedIn('App\Actions');
