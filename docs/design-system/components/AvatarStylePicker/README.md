Sélecteur du style d'avatar DiceBear de l'instance (Admin › Branding), avec option de choix par membre.

## Quand l'utiliser

- **Admin › Branding** : choisir le style par défaut de l'instance et décider si les membres peuvent le changer.
- **Paramètres utilisateur › Profil** : même grille quand l'admin autorise le choix ; sinon, carte « Style imposé par l'administrateur » avec un bouton désactivé.
- Partout ailleurs (PresenceStack, RetroCard, curseurs, sièges de poker), l'avatar s'affiche simplement : on ne choisit jamais de style hors de ces deux écrans.

## Principes

- **Seed stable** : l'ULID de l'utilisateur, jamais l'e-mail. Le même avatar s'affiche partout et ne révèle rien. Pour un invité, le seed est `pseudo + id de session`.
- **Fond = couleur de présence.** On génère avec `backgroundColor: ['transparent']` et le cercle `bg-skrum-presence-N` donne le fond. La personne reste reconnaissable par sa couleur, et ça suit le thème clair/sombre. Les initiales restent le fallback : chargement, style « Initiales », ou DiceBear désactivé.
- **Self-host d'abord.** Pas d'appel à `api.dicebear.com` par défaut : génération **côté serveur** en PHP (paquet compatible, ou sidecar Node `@dicebear/core` + `@dicebear/collection`) ou côté client avec les paquets npm. Le SVG est mis en cache par `style + seed + version`. L'API hébergée reste une option admin, désactivée par défaut, pour ne pas envoyer d'identifiants à un tiers.
- **Licences.** Chaque tuile affiche sa licence : CC0 ou libre, sans obligation ; **CC BY 4.0**, attribution obligatoire, ajoutée automatiquement à la page « À propos / Licences » de l'instance quand ce style est actif. Le style recommandé par défaut est **Notionists** (CC0) : sobre et lisible en petit.
- L'avatar reste décoratif : le nom est toujours donné par `aria-label` ou par le texte à côté. Pas d'animation.

## Anatomie

Tuile radio : 3 avatars d'exemple (seeds de l'équipe), nom du style, badge de licence, badge « Recommandé », coche quand la tuile est sélectionnée. La grille est en `auto-fill` (tuiles de 9.5rem minimum). Sous la grille : le switch « Les membres peuvent choisir leur propre style », puis l'aperçu (tailles lg et md, pile de présence, invité).

## Props

```ts
type AvatarStyle = 'initials' | 'notionists' | 'thumbs' | 'lorelei' | 'glass' | 'shapes' | 'rings' | 'funEmoji' | 'botttsNeutral' | 'pixelArtNeutral' | 'identicon' | string; // clés @dicebear/collection
interface AvatarStylePickerProps {
  value: AvatarStyle;
  onChange: (style: AvatarStyle) => void;
  styles?: AvatarStyle[];            // sous-ensemble proposé (défaut : 10 + « 31 styles » qui ouvre la liste complète)
  sampleSeeds: string[];             // 3 à 4 ids de membres pour les aperçus
  allowMemberChoice: boolean;
  onAllowMemberChoiceChange: (v: boolean) => void;
  locked?: boolean;                  // vue membre quand l'admin impose le style
}
interface SkrumAvatarProps { seed: string; style: AvatarStyle; presence: 1|2|3|4|5|6|7|8|9|10|11|12; initials: string; size?: 'xs'|'sm'|'md'|'lg'|'xl'; label: string }
```

## États

Tuile : défaut, survol (`accent`), focus clavier (anneau `ring`), sélectionnée (`skrum-primary-soft`, bordure `primary`, coche). La grille peut aussi être verrouillée (vue membre). L'aperçu se met à jour dès qu'on change de tuile.

## Accessibilité & clavier

`role="radiogroup"` avec `aria-label`, tuiles en `role="radio"`, flèches pour se déplacer, Espace pour choisir. Chaque avatar porte un `aria-label` avec le nom de la personne. Le contraste de l'avatar n'est pas porteur d'information : le nom est toujours visible.

## Tokens

`card`, `input`, `accent`, `ring`, `primary`, `skrum-primary-soft`, `skrum-primary-text`, `skrum-presence-1…12` (fond des avatars), badges `muted` / `warning` / `outline` pour les licences.

## Mapping shadcn / Tailwind

`RadioGroup` de shadcn avec `RadioGroupItem asChild` sur une carte : `grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(38)),1fr))] gap-2`, tuile `rounded-lg border border-input bg-card p-3 data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft`. `Avatar` : `AvatarImage src={svgDataUri}` sur `AvatarFallback` (initiales), fond `bg-skrum-presence-N`.

## Styles DiceBear disponibles (licences lues dans `@dicebear/collection`)

| Clé | Nom | Auteur | Licence |
| --- | --- | --- | --- |
| `adventurer` | Adventurer | Lisa Wischofsky | CC BY 4.0 |
| `adventurerNeutral` | Adventurer Neutral | Lisa Wischofsky | CC BY 4.0 |
| `avataaars` | Avataaars | Pablo Stanley | Free for personal and commercial use |
| `avataaarsNeutral` | Avataaars | Pablo Stanley | Free for personal and commercial use. |
| `bigEars` | Face Generator | The Visual Team | CC BY 4.0 |
| `bigEarsNeutral` | Face Generator | The Visual Team | CC BY 4.0 |
| `bigSmile` | Custom Avatar | Ashley Seo | CC BY 4.0 |
| `bottts` | Bottts | Pablo Stanley | Free for personal and commercial use |
| `botttsNeutral` | Bottts | Pablo Stanley | Free for personal and commercial use |
| `croodles` | Croodles - Doodle your face | vijay verma | CC BY 4.0 |
| `croodlesNeutral` | Croodles - Doodle your face | vijay verma | CC BY 4.0 |
| `dylan` | Dylan! The Avatar Generator | Natalia Spivak | CC BY 4.0 |
| `funEmoji` | Fun Emoji Set | Davis Uche | CC BY 4.0 |
| `glass` | Glass | DiceBear | CC0 1.0 |
| `icons` | Bootstrap Icons | The Bootstrap Authors | MIT |
| `identicon` | Identicon | DiceBear | CC0 1.0 |
| `initials` | Initials | DiceBear | CC0 1.0 |
| `lorelei` | Lorelei | Lisa Wischofsky | CC0 1.0 |
| `loreleiNeutral` | Lorelei Neutral | Lisa Wischofsky | CC0 1.0 |
| `micah` | Avatar Illustration System | Micah Lanier | CC BY 4.0 |
| `miniavs` | Miniavs - Free Avatar Creator | Webpixels | CC BY 4.0 |
| `notionists` | Notionists | Zoish | CC0 1.0 |
| `notionistsNeutral` | Notionists | Zoish | CC0 1.0 |
| `openPeeps` | Open Peeps | Pablo Stanley | CC0 1.0 |
| `personas` | Personas by Draftbit | Draftbit - draftbit.com | CC BY 4.0 |
| `pixelArt` | Pixel Art | DiceBear | CC0 1.0 |
| `pixelArtNeutral` | Pixel Art Neutral | DiceBear | CC0 1.0 |
| `rings` | Rings | DiceBear | CC0 1.0 |
| `shapes` | Shapes | DiceBear | CC0 1.0 |
| `thumbs` | Thumbs | DiceBear | CC0 1.0 |
| `toonHead` | ToonHead | Johan Melin | CC BY 4.0 |

Vérifie les licences à chaque montée de version de `@dicebear/collection`. La colonne licence de ce tableau vient des métadonnées du paquet installé.
