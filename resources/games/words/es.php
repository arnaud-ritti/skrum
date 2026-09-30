<?php

$drawable = [
    'portátil', 'teclado', 'ratón', 'monitor', 'impresora', 'taza de café', 'pizza', 'sándwich', 'galleta', 'plátano',
    'manzana', 'cohete', 'robot', 'araña', 'pizarra', 'nota adhesiva', 'rotulador', 'lápiz', 'tijeras', 'grapadora',
    'clip', 'calendario', 'reloj', 'despertador', 'reloj de arena', 'cronómetro', 'trofeo', 'medalla', 'corona', 'bombilla',
    'batería', 'enchufe', 'auriculares', 'micrófono', 'cámara', 'teléfono móvil', 'satélite', 'antena', 'servidor', 'nube',
    'paraguas', 'arcoíris', 'sol', 'luna', 'estrella', 'planeta', 'volcán', 'montaña', 'isla', 'puente',
    'faro', 'castillo', 'casa', 'escritorio', 'silla', 'sofá', 'lámpara', 'ventana', 'puerta', 'llave',
    'candado', 'cartera', 'moneda', 'hucha', 'mochila', 'maleta', 'maletín', 'sobre', 'buzón', 'periódico',
    'libro', 'cuaderno', 'mapa', 'brújula', 'ancla', 'velero', 'submarino', 'tren', 'bicicleta', 'patinete',
    'coche', 'autobús', 'camión', 'tractor', 'helicóptero', 'avión', 'paracaídas', 'globo', 'cometa', 'escalera',
    'martillo', 'llave inglesa', 'destornillador', 'sierra', 'pala', 'cubo', 'escoba', 'cepillo de dientes', 'gafas', 'sombrero',
    'corbata', 'camisa', 'calcetín', 'bota', 'guante', 'bufanda', 'anillo', 'guitarra', 'piano', 'tambor',
    'trompeta', 'violín', 'balón de fútbol', 'balón de baloncesto', 'monopatín', 'dados', 'rompecabezas', 'osito de peluche', 'muñeco de nieve', 'cactus',
    'flor', 'árbol', 'hoja', 'seta', 'zanahoria', 'piña', 'cereza', 'limón', 'pastel', 'dónut',
    'helado', 'palomitas', 'hamburguesa', 'taco', 'sushi', 'queso', 'pan', 'pez', 'ballena', 'pulpo',
    'tortuga', 'pingüino', 'búho', 'elefante', 'jirafa', 'león', 'mono', 'caracol', 'mariposa', 'abeja',
    'dragón', 'fantasma', 'unicornio', 'linterna', 'vela', 'hoguera', 'imán', 'microscopio', 'telescopio', 'termómetro',
    'escudo', 'bandera', 'tienda de campaña', 'valla', 'semáforo', 'fuente', 'molino de viento', 'iglú', 'pirámide', 'serpiente',
    'rana', 'conejo', 'caballo', 'pato', 'cerdo', 'vaca', 'bicho', 'nave espacial', 'campana', 'mariquita',
];

$abstract = [
    'sprint', 'backlog', 'retrospectiva', 'fecha límite', 'despliegue', 'reunión diaria', 'velocidad', 'estimación', 'comentarios', 'refactorización',
    'solicitud de cambios', 'revisión de código', 'conflicto de fusión', 'lanzamiento', 'hoja de ruta', 'hito', 'parte interesada', 'dueño de producto', 'scrum master', 'historia de usuario',
    'épica', 'definición de hecho', 'burndown', 'kanban', 'flujo de trabajo', 'prioridad', 'bloqueo', 'dependencia', 'deuda técnica', 'parche',
    'reversión', 'base de datos', 'algoritmo', 'variable', 'función', 'framework', 'biblioteca', 'compilador', 'depurador', 'sintaxis',
    'excepción', 'tiempo de espera', 'latencia', 'ancho de banda', 'contraseña', 'cortafuegos', 'cifrado', 'copia de seguridad', 'versión', 'rama',
    'commit', 'repositorio', 'pipeline', 'contenedor', 'migración', 'prototipo', 'boceto', 'usabilidad', 'accesibilidad', 'incorporación',
    'reunión', 'agenda', 'lluvia de ideas', 'taller', 'presentación', 'presupuesto', 'factura', 'estrategia', 'visión', 'innovación',
    'colaboración', 'confianza', 'empatía', 'motivación', 'concentración', 'paciencia', 'curiosidad', 'valentía', 'trabajo en equipo', 'consenso',
    'compromiso', 'decisión', 'experimento', 'hipótesis', 'métrica', 'percepción', 'iteración', 'incremento', 'alcance', 'calidad',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
