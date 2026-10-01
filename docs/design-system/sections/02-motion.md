# Motion

Le mouvement sert à **suivre les autres en temps réel** et à **marquer les moments du rituel** (révélation, fin). Jamais pour décorer.

## Durées et courbes

| Token | Valeur | Usage |
| --- | --- | --- |
| `duration-instant` | 80 ms | press, toggle de réaction |
| `duration-fast` | 140 ms | hover, focus, tooltip, VoteDot |
| `duration-base` | 220 ms | popover, dropdown, apparition de carte, changement de phase |
| `duration-slow` | 360 ms | dialog, sheet, drawer, regroupement de cartes |
| `duration-flip` | 520 ms | retournement PokerCard, révélation des cartes masquées |
| `duration-celebrate` | 1400 ms | confettis de fin (une seule salve) |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | changements d'état |
| `ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | entrées |
| `ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | sorties (durée × 0,7) |
| `ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | vote, sélection de carte, pastille de présence |
| `ease-flip` | `cubic-bezier(0.45, 0, 0.2, 1)` | rotation 3D |

## Animations clés

- **Apparition d'une carte** (`animate-card-in`) : `opacity 0→1`, `translateY(0.5rem)→0`, `scale(.98)→1`, 220 ms `ease-enter`. Une carte ajoutée par un autre participant arrive avec la même animation, sans flash de couleur.
- **Vote** (`animate-vote-pop`) : la pastille `sk-vdot` passe `scale .4 → 1.25 → 1` en 220 ms `ease-spring` ; le compteur change sans animation de chiffre (lisibilité).
- **Retournement de carte poker** : conteneur `perspective: 37.5rem`, `.flip-3d` `rotateY(180deg → 0)` 520 ms `ease-flip`, faces en `backface-visibility: hidden`. À la révélation, les cartes se retournent **en cascade de 40 ms** dans l'ordre des sièges (max 400 ms de décalage total).
- **Révélation des cartes rétro** : le masque rayé se dissout (`opacity`, 220 ms) colonne par colonne, décalage 60 ms.
- **Drag** : saisie → `rotate(-2deg) scale(1.03)` + `shadow-drag` en 140 ms `ease-spring` ; dépôt → retour à plat 220 ms `ease-standard` ; l'emplacement d'origine devient un fantôme en pointillés.
- **Regroupement** : les cartes glissent vers le groupe (FLIP, 360 ms `ease-standard`), le groupe s'agrandit ensuite.
- **Timer** : < 1 min → fond `skrum-warning`, sans clignotement ; à 0 → `destructive` + `animate-nudge` (2 petites secousses) et un son optionnel (désactivé par défaut).
- **Présence / écriture** : loader tréma `animate-trema` (2 points, décalage 180 ms). Arrivée d'un participant : avatar qui entre dans la pile avec `ease-spring`.
- **Confettis de fin de session** : une seule salve, 24 éclats max, formes de post-its (rectangles arrondis) et points tréma, couleurs des colonnes utilisées dans la session, depuis le bouton « Terminer » ; 1400 ms puis fondu. Jamais en boucle, jamais pendant la discussion.

## prefers-reduced-motion

Toutes les animations passent à 1 ms ; le retournement de carte devient un fondu d'opacité 120 ms ; pas de confettis (remplacés par un toast « Session terminée — 6 actions créées ») ; les curseurs live sont téléportés sans interpolation ; le drag ne tourne plus la carte. Le réglage est aussi proposé dans le profil (« Réduire les animations ») pour ceux qui ne l'ont pas au niveau du système.
