Curseur distant : flèche à la couleur de présence d'un participant avec son prénom, sur whiteboard et board de rétro.

## Quand l'utiliser
- Canevas partagés (whiteboard, regroupement de rétro). Pas sur mobile (pas de pointeur) : on montre la sélection distante à la place.
- Toujours accompagné du réglage « Afficher les curseurs ».

## Anatomie
Flèche SVG (remplie `--cur`, contour `--card`, ombre portée) · étiquette pilule (fond `--cur`, texte `--cur-fg`, liseré `--card`) avec prénom, et action éventuelle (« déplace ») · positionnée en coordonnées du canevas, au-dessus des objets (`--z-cursor`).

## Props
```ts
interface LiveCursorProps {
  userId: string;
  name: string;
  presence: number;                 // 1..12 → --cur / --cur-fg
  x: number;                        // coordonnées monde (canevas)
  y: number;
  action?: "idle" | "dragging" | "drawing" | "typing";
  idle?: boolean;                   // > 10 s immobile → étiquette masquée
}

interface CursorLayerProps {
  cursors: LiveCursorProps[];
  visible: boolean;                 // réglage « Afficher les curseurs »
  shareMine: boolean;               // réglage « Partager mon curseur »
  viewport: { x: number; y: number; zoom: number };
}
```

## États
curseur simple · curseur en drag (objet penché, `--shadow-drag`, étiquette « Inès · déplace ») · inactif (flèche seule, opacité réduite) · masqués (réglage off : badge « 4 curseurs masqués ») · invité (pseudo).

## Accessibilité & clavier
- Couche décorative : `aria-hidden="true"`, `pointer-events: none`. L'information utile (qui est là, qui édite) est portée par `PresenceStack` et les verrous de carte.
- Réglage : `Switch` avec `role="switch"` et `aria-checked` ; raccourci <kbd>Maj</kbd>+<kbd>C</kbd>.
- `prefers-reduced-motion` : pas d'interpolation, positions mises à jour par saut.

## Temps réel
- Whisper `client-cursor {x, y, action}` sur `presence-whiteboard.{boardId}`, throttlé à 20 Hz (50 ms), interpolé côté client (lerp sur `--duration-fast`).
- Jamais persisté ni passé par la base ; ignoré si `shareMine=false`.
- Départ d'un participant (`.leaving`) : curseur retiré en fondu.

## Mapping shadcn
Réglages via `Switch` (`data-[state=checked]:bg-primary`) dans un `Card` ou un `DropdownMenu` « Affichage ».

## À faire / À éviter
- Faire : prénom court (tronqué à 16 caractères) ; couleur = même couleur que l'avatar.
- Éviter : afficher son propre curseur ; plus de 20 curseurs (au-delà, seuls les plus proches du viewport).

## Tokens
`--skrum-presence-1…12` + `-foreground` (via `--cur` / `--cur-fg`) `--card` `--skrum-canvas` `--skrum-canvas-dot` `--shadow-drag` `--z-cursor` `--duration-fast` `--radius-full` `--radius-xl` `--primary`
