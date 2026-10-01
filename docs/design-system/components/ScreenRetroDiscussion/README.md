Rétro en phase Discussion (desktop 1440, EN puis FR) : on traite les sujets du plus voté au moins voté, un à la fois, et on en tire des actions.

**Zones**
- Sidebar repliée (`active='sessions'`), topbar avec PhaseStepper sur Discussion (4 phases cochées).
- Colonne gauche « Sujets (6) » triés par votes : sujet discuté (coché, nb d'actions), sujet courant surligné (`--skrum-primary-soft` + anneau `--primary`, temps restant), sujets à venir ; pied : « Sujet 2 sur 6 », progression, temps estimé.
- Centre : bandeau info « Arnaud a mis ce sujet en focus — tout le monde regarde ici » (8/8), navigation Sujet précédent / suivant, timer par sujet (`sk-timer--lg`, +1 min), sujet en focus agrandi (`CardGroup` : rang, titre, total de votes, 3 cartes avec auteur ou Anonyme et réactions), aperçu « À suivre ».
- Droite : Notes de discussion partagées (saisie live d'Inès, tréma), « Actions du sujet » : action existante + bouton **Créer une action** ouvert → ActionItem en création (lié au sujet, responsable, échéance, priorité, ticket Jira, Annuler / Créer).
- Dock centré sur la colonne du milieu : `ReactionBar` au-dessus de la `FacilitatorBar` (écart `space-3`) : Tout le monde suit (activé), précédent/suivant, Actions →.

**Comportement** — « Tout le monde suit » force le scroll et le focus de tous sur le sujet du facilitateur (événement `FocusChanged`) ; un participant qui navigue ailleurs voit « Revenir au sujet ». Le timer de sujet passe en `is-low` sous 1 min puis `is-done`. Les notes sont un champ collaboratif attaché au sujet et reprises dans le récap.

**Composants** — Sidebar, PhaseStepper, PresenceStack, Timer, CardGroup, RetroCard, ActionItem, Select, Input, LiveCursor, ReactionBar, FacilitatorBar.

**Mobile** — la liste des sujets devient un sélecteur en haut (« 2/6 ▾ »), le sujet en focus occupe l'écran, notes et actions passent dans un Drawer à onglets ; navigation par balayage horizontal.
