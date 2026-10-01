Landing marketing de Skrüm (desktop 1440, page longue ~3930 px) : promesse, aperçu produit, modules, self-host, tarifs.

**But** — convertir une équipe (essai SaaS) ou un admin technique (self-host) en montrant le vrai produit, sans photos, faux logos ni témoignages.

**Zones**
1. Nav : logo + mot-symbole, liens (Modules, Self-host, Tarifs, Documentation, Changelog), GitHub, Se connecter, CTA primaire.
2. Hero : badge « Open source · SaaS ou auto-hébergé », titre display-2xl « Les réunions se terminent, les actions restent. » (2ᵉ moitié en `--skrum-primary-text`), lead, 2 CTA, commande `docker compose` en mono copiable.
3. Aperçu produit : mini board réel (PhaseStepper phase Actions, Timer, PresenceStack, 3 RetroColumn, panneau ActionItem, LiveCursor).
4. Modules (grille 6 col. : 3+3 / 2+2+2) : Rétro (RetroCard + CardGroup + VoteDots), Poker (PokerCard + distribution), Whiteboard (sticky + flèche), Icebreakers (sk-letter), Sondages (ROTI).
5. Self-host / open source : 4 arguments (licence, SSO OIDC, branding, SMTP), bloc de code Tabs Docker Compose / Helm, carte « Apparence de l'instance » (swatches, Slider, aperçu).
6. Tarifs : Gratuit / Équipe (recommandé, bordure `--primary`) / Organisation + bandeau « Self-host : gratuit » sur `--secondary`.
7. CTA final sur `--skrum-primary-soft`, footer 4 colonnes.

**Composants** — Button, Badge, Tabs, Slider, Card, sk-rcard, sk-column, sk-group, sk-votes, sk-phases, sk-timer, sk-stack, sk-cursor, sk-action, sk-prio, sk-ticket, sk-pcard, sk-dist, sk-sticky, sk-letter, sk-roti.

**Mobile** — nav en menu burger (Sheet) ; hero en display-xl, CTA pleine largeur empilés ; aperçu produit réduit à une colonne + panneau Actions en dessous (scroll horizontal des colonnes) ; modules et plans en 1 colonne ; bloc de code scrollable horizontalement.

**À valider** — licence AGPL-3.0, prix (8 €/membre/mois, « Sur devis ») et chemins d'image `ghcr.io/skrum/...` sont des placeholders.
