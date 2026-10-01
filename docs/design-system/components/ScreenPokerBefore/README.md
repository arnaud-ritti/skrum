Salle de planning poker avant révélation (desktop 1440×900) : l'équipe vote en secret sur la story en cours.

**Zones**
- Topbar : séance + badges « Planning poker » / « Tour 1 · vote en cours », Timer, PresenceStack, Partager.
- Story en cours (Card) : ticket ATLAS-1287, type, étiquette, position dans la séance, titre, description, critères d'acceptation.
- Table (sk-ptable) avec 8 sièges : PokerCard face cachée (`is-hidden`) + « A voté » pour ceux qui ont voté, emplacement vide (`is-empty`) + « Réfléchit » (tréma) pour les autres ; au centre, progression 7/8 et bouton facilitateur « Révéler les cartes ».
- Deck Fibonacci (0 → 21, ?, ☕) en bas ; ma carte sélectionnée (`is-selected`, levée) avec rappel « modifiable jusqu'à la révélation ».
- ReactionBar (`sk-rbar`, `sk-rbar-e` > `<span>` emoji, `sk-rbar-sep`, `sk-rbar-add` + `smile-plus`) : 👍 ❤️ 👏 🎉 🤔 👎 + ajouter, centrée **au-dessus** du panneau du deck, écart `--space-3`. Elle est dans le flux : `.scr-dock` (colonne flex, `margin-top: auto`) empile barre puis panneau — jamais de position absolue, jamais de chevauchement.
- Panneau droit : file des stories (estimées avec points, en cours surlignée, à venir), ajout / import Jira, réglages facilitateur (deck, révélation auto, observateurs).

**Temps réel** — l'état « a voté » est diffusé sans la valeur ; la révélation retourne toutes les cartes en même temps (`--duration-flip`, `--ease-flip`).

**Mobile** — table remplacée par une grille d'avatars + état ; deck en scroll horizontal collé en bas ; file des stories en Sheet.

**Note** — `.sk-pcard-in { border-radius: inherit; }` ajouté localement : sans lui les faces de PokerCard perdent leurs coins arrondis.
