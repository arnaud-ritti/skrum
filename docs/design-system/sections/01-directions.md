# Directions de marque

Deux directions contrastées ont été explorées. Toutes deux gardent la même structure de tokens : passer de l'une à l'autre ne change que des valeurs.

## A — « Encre & Post-it »

L'outil comme un carnet de développeur : UI quasi monochrome, encre bleu-nuit, papier froid, et **les post-its sont la seule couleur**.

| Rôle | Clair | Sombre |
| --- | --- | --- |
| `background` | papier froid `#f9fafc` | `#0b0d12` |
| `primary` | encre `oklch(0.30 0.035 265)` · `#252e40` (13,3:1 avec texte clair) | `oklch(0.90 0.02 265)` · `#d7deec` + texte encre |
| accent de marque | surligneur soleil `#f6d653` (réservé au tréma et aux sélections) | idem |
| Typo | Figtree + JetBrains Mono très présent (IDs, compteurs, en-têtes) | |

- **Pour** : sobre, très « outil de dev », laisse toute la place aux post-its ; white-label trivial (une instance change juste l'encre).
- **Contre** : proche des codes Linear / Vercel, peu mémorable ; l'état actif n'a plus de couleur propre (tout repose sur la luminosité) ; la chaleur promise par la marque passe uniquement par les post-its.

## B — « Terracotta & Sauge » (recommandée, détaillée dans ce système)

L'atelier plutôt que le bureau : neutres chauds de papier kraft, **terracotta** pour l'action et le focus, **sauge** pour le calme (secondaire, table de poker), post-its vifs mais désaturés d'un cran pour vivre ensemble.

| Rôle | Clair | Sombre |
| --- | --- | --- |
| `background` | `oklch(0.985 0.004 80)` · `#fbfaf7` | `oklch(0.165 0.008 55)` · `#110d0b` |
| `primary` | terracotta `oklch(0.56 0.15 38)` · `#bb4d2a` | `oklch(0.72 0.135 42)` · `#ea865e` + texte encre |
| `secondary` | sauge `oklch(0.945 0.028 150)` | `oklch(0.285 0.035 155)` |
| Typo | Figtree (UI) + Bricolage Grotesque (display) + JetBrains Mono | |

- **Pour** : immédiatement reconnaissable face aux concurrents (violets, bleus, turquoises) ; chaleureux sans être enfantin ; l'état actif a une couleur franche ; la sauge donne un deuxième registre calme.
- **Contre** : le terracotta est voisin du rouge d'erreur → règle stricte : `destructive` toujours avec icône + libellé (et un rouge plus froid, plus saturé). Le soleil et l'abricot demandent un texte foncé (géré par les tokens).

**Pourquoi B** : Skrüm promet une ambiance où l'on a envie de parler franchement. La chaleur doit être dans le système, pas seulement dans le contenu. B porte cette promesse tout en restant crédible pour des équipes tech, et elle se white-labelise aussi bien que A grâce aux dérivations automatiques.
