Question de sondage : échelle 1-5, NPS 0-10, choix unique, choix multiple ou texte libre, en vue réponse et en vue résultats agrégés.

## Quand l'utiliser
- Sondages d'équipe (moral, sécurité psychologique, feedback de rétro), en live ou asynchrone, souvent anonymes.
- Pour le ROTI de fin de rétro, préférer `ROTIWidget`.

## Anatomie
Carte (`sk-card`) · numéro « 1 / 5 » + type · intitulé · contrôle selon le type : `sk-scale` (1-5, bornes libellées), `sk-scale sk-nps` (0-10), `sk-opt` + radio, `sk-opt` + case (limite « 3 max »), `sk-textarea` + compteur · résultats : chiffre clé (moyenne, score NPS), `sk-result` (barre pleine `--chart-1` = réponse majoritaire, autres à 45 %), histogramme NPS coloré détracteurs/passifs/promoteurs, nuage de mots-clés + citations.

## Props
```ts
type QuestionType = "scale5" | "nps" | "single" | "multiple" | "text";

interface SurveyQuestionProps {
  id: string;
  index: number;
  count: number;
  type: QuestionType;
  label: string;
  options?: { id: string; label: string }[];     // single / multiple
  maxChoices?: number;                             // multiple
  scaleLabels?: [min: string, max: string];
  anonymous?: boolean;
  required?: boolean;
  mode: "answer" | "results";
  value?: number | string | string[] | null;
  results?: {
    responses: number;
    mean?: number;                                 // scale5
    nps?: number;                                  // -100..100
    buckets: { key: string; label: string; count: number }[];
    keywords?: { word: string; weight: 1 | 2 | 3 }[];
    quotes?: string[];
  };
  onChange?: (v: SurveyQuestionProps["value"]) => void;
}
```

## États
réponse : non répondu · sélectionné · focus · limite de choix atteinte (options restantes désactivées) · texte en saisie avec compteur · erreur « réponse requise ». Résultats : 1-5 avec moyenne · NPS avec répartition · choix unique en % · choix multiple en nombre (% des répondants) · texte libre (mots-clés + citations, « Voir les N autres »).

## Accessibilité & clavier
- Échelles et choix unique : `role="radiogroup"` + `aria-labelledby` (intitulé) ; <kbd>←</kbd>/<kbd>→</kbd> changent, chiffres <kbd>1</kbd>–<kbd>5</kbd> directs.
- Choix multiple : `role="group"`, cases `role="checkbox"`, <kbd>Espace</kbd> coche.
- Bornes d'échelle liées via `aria-describedby`.
- Résultats : barres doublées par la valeur en texte ; histogramme NPS `role="img"` + `aria-label`.

## Temps réel
- Sondage live : `ResponseSubmitted {questionId, count}` sur `presence-survey.{id}` (compteur de réponses seulement).
- `ResultsPublished` pousse les agrégats ; en anonyme, jamais de réponse individuelle diffusée, et agrégats masqués sous 3 réponses.

## Mapping shadcn
`RadioGroup` / `RadioGroupItem`, `Checkbox`, `Textarea`, `Card`, `Progress` (barres de résultat), `Badge variant="secondary"`, `ToggleGroup` pour l'échelle (`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground`).

## À faire / À éviter
- Faire : libeller les deux bornes des échelles ; indiquer « anonyme » avant la réponse.
- Éviter : couleurs de statut pour les résultats (hors segments NPS) ; afficher les résultats avant d'avoir répondu.

## Tokens
`--card` `--border` `--input` `--foreground` `--muted` `--muted-foreground` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--chart-1` `--skrum-roti-1` `--skrum-roti-3` `--skrum-roti-5` `--ring` `--font-display` `--radius` `--radius-full` `--shadow-card` `--shadow-raised` `--space-3` `--space-5`
