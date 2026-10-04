<?php

$themes = [
    'work' => [
        'drawable' => [
            'portátil', 'teclado', 'ratón', 'monitor', 'impresora', 'taza de café', 'cohete', 'robot', 'pizarra', 'nota adhesiva',
            'rotulador', 'lápiz', 'tijeras', 'grapadora', 'clip', 'calendario', 'reloj', 'despertador', 'reloj de arena', 'cronómetro',
            'trofeo', 'medalla', 'bombilla', 'batería', 'enchufe', 'auriculares', 'micrófono', 'cámara', 'teléfono móvil', 'satélite',
            'antena', 'servidor', 'escritorio', 'silla', 'lámpara', 'maletín', 'sobre', 'cuaderno', 'imán', 'microscopio',
            'telescopio', 'termómetro', 'nave espacial',
        ],
        'abstract' => [
            'sprint', 'backlog', 'retrospectiva', 'fecha límite', 'despliegue', 'reunión diaria', 'velocidad', 'estimación', 'comentarios', 'refactorización',
            'solicitud de cambios', 'revisión de código', 'conflicto de fusión', 'lanzamiento', 'hoja de ruta', 'hito', 'parte interesada', 'dueño de producto', 'scrum master', 'historia de usuario',
            'épica', 'definición de hecho', 'burndown', 'kanban', 'flujo de trabajo', 'prioridad', 'bloqueo', 'dependencia', 'deuda técnica', 'parche',
            'reversión', 'base de datos', 'algoritmo', 'variable', 'función', 'framework', 'biblioteca', 'compilador', 'depurador', 'sintaxis',
            'excepción', 'tiempo de espera', 'latencia', 'ancho de banda', 'contraseña', 'cortafuegos', 'cifrado', 'copia de seguridad', 'versión', 'rama',
            'commit', 'repositorio', 'pipeline', 'contenedor', 'migración', 'prototipo', 'boceto', 'usabilidad', 'accesibilidad', 'incorporación',
            'reunión', 'agenda', 'lluvia de ideas', 'taller', 'presentación', 'presupuesto', 'factura', 'estrategia', 'visión', 'innovación',
            'colaboración', 'confianza', 'empatía', 'motivación', 'concentración', 'paciencia', 'curiosidad', 'valentía', 'trabajo en equipo', 'consenso',
            'término medio', 'decisión', 'experimento', 'hipótesis', 'métrica', 'hallazgo', 'iteración', 'incremento', 'alcance', 'calidad',
        ],
    ],
    'food' => [
        'drawable' => [
            'pizza', 'sándwich', 'galleta', 'plátano', 'manzana', 'zanahoria', 'piña', 'cereza', 'limón', 'pastel',
            'dónut', 'helado', 'palomitas', 'hamburguesa', 'taco', 'sushi', 'queso', 'pan',
        ],
    ],
    'nature' => [
        'drawable' => [
            'araña', 'nube', 'arcoíris', 'sol', 'luna', 'estrella', 'planeta', 'volcán', 'montaña', 'isla',
            'cactus', 'flor', 'árbol', 'hoja', 'seta', 'pez', 'ballena', 'pulpo', 'tortuga', 'pingüino',
            'búho', 'elefante', 'jirafa', 'león', 'mono', 'caracol', 'mariposa', 'abeja', 'serpiente', 'rana',
            'conejo', 'caballo', 'pato', 'cerdo', 'vaca', 'bicho', 'mariquita',
        ],
    ],
    'objects' => [
        'drawable' => [
            'corona', 'paraguas', 'puente', 'faro', 'castillo', 'casa', 'sofá', 'ventana', 'puerta', 'llave',
            'candado', 'cartera', 'moneda', 'hucha', 'mochila', 'maleta', 'buzón', 'periódico', 'libro', 'mapa',
            'brújula', 'ancla', 'velero', 'submarino', 'tren', 'bicicleta', 'patinete', 'coche', 'autobús', 'camión',
            'tractor', 'helicóptero', 'avión', 'paracaídas', 'globo', 'cometa', 'escalera', 'martillo', 'llave inglesa', 'destornillador',
            'sierra', 'pala', 'cubo', 'escoba', 'cepillo de dientes', 'gafas', 'sombrero', 'corbata', 'camisa', 'calcetín',
            'bota', 'guante', 'bufanda', 'anillo', 'guitarra', 'piano', 'tambor', 'trompeta', 'violín', 'balón de fútbol',
            'balón de baloncesto', 'monopatín', 'dados', 'rompecabezas', 'osito de peluche', 'muñeco de nieve', 'dragón', 'fantasma', 'unicornio', 'linterna',
            'vela', 'hoguera', 'escudo', 'bandera', 'tienda de campaña', 'valla', 'semáforo', 'fuente', 'molino de viento', 'iglú',
            'pirámide', 'campana',
        ],
    ],
];

$entries = [];

foreach ($themes as $theme => $lists) {
    foreach ($lists['drawable'] ?? [] as $word) {
        $entries[] = ['word' => $word, 'drawable' => true, 'theme' => $theme];
    }

    foreach ($lists['abstract'] ?? [] as $word) {
        $entries[] = ['word' => $word, 'drawable' => false, 'theme' => $theme];
    }
}

return $entries;
