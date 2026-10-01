Carte de planning poker : valeur d'estimation, face cachée ou révélée, avec retournement 3D à la révélation.

## Quand l'utiliser
- Deck du participant (bas de l'écran, taille `md`), sièges de la `PokerTable` (`sm`), résultat (`lg`).
- Decks : Fibonacci `0 1 2 3 5 8 13 21`, T-shirt `XS S M L XL`, personnalisé (valeurs + unité), cartes spéciales `?` et `☕`.

## Anatomie
Conteneur avec perspective · `sk-pcard-in` (préserve la 3D) · face (`--card`, valeur en `--font-display`, rappel en coin) · dos (`--primary` + motif de points tréma `--primary-foreground`, cadre intérieur) · unité optionnelle en bas (« jours »).

## Props
```ts
type PokerValue = string;           // "5", "M", "½", "?", "☕"

interface PokerCardProps {
  value: PokerValue;
  unit?: string;                    // deck personnalisé
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;               // retirée du deck ou vote clos
  empty?: boolean;                  // siège sans vote
  special?: boolean;                // "?" ou "☕"
  size?: "sm" | "md" | "lg";
  onSelect?: (v: PokerValue) => void;
}

interface PokerDeckProps {
  kind: "fibonacci" | "tshirt" | "custom";
  values: PokerValue[];
  value: PokerValue | null;
  onChange: (v: PokerValue) => void;
}
```

## États
face cachée · révélée · sélectionnée (soulevée de 10 px, `--skrum-primary-soft`, anneau `--primary`) · focus clavier · désactivée (opacité .4) · pas de vote (pointillés) · spéciale (`--muted`) · tailles sm/md/lg · retournement : 180° → 125° → 55° → 0° sur `--duration-flip` / `--ease-flip`, cartes décalées de 40 ms.

## Accessibilité & clavier
- Deck = `role="radiogroup"`, chaque carte `role="radio"` + `aria-checked` ; `?` → « Je ne sais pas », `☕` → « Besoin d'une pause ».
- <kbd>←</kbd>/<kbd>→</kbd> parcourent, <kbd>Espace</kbd> choisit ; chiffres <kbd>0</kbd>–<kbd>9</kbd> sélection directe ; <kbd>Échap</kbd> retire le vote.
- Face cachée : `aria-label="Carte face cachée"` — la valeur n'est pas dans le DOM avant la révélation.
- `prefers-reduced-motion` : fondu 120 ms au lieu de la rotation.

## Temps réel
- `client`→HTTP `POST /poker/{id}/votes` ; broadcast `VoteCast {userId}` sans valeur sur `presence-poker.{id}`.
- `VotesRevealed {votes: {userId, value}[]}` déclenche le retournement simultané.
- `RoundReset` remet toutes les cartes en `faceDown`, le deck se désélectionne.

## À faire / À éviter
- Faire : garder `☕` et `?` en fin de deck, visuellement distincts.
- Éviter : révéler la valeur au survol ; plus de 12 cartes par deck (scroll horizontal sur mobile sinon).

## Tokens
`--card` `--border` `--input` `--foreground` `--muted` `--muted-foreground` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--ring` `--font-display` `--font-sans` `--radius-xl` `--radius-md` `--shadow-card` `--shadow-raised` `--duration-flip` `--ease-flip` `--duration-base` `--ease-spring`
