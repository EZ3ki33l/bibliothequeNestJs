import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from '@heroui/react';
import { EyeIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import {
  createAdminEntry,
  updateAdminEntry,
  type AdminCategoryListItem,
  type AdminEntryDifficulty,
  type AdminEntryKind,
} from '../../lib/admin';
import { publicationGaps, publicationQuestion } from '../../lib/entryChecks';
import { todayAsDay, type EntrySource } from '../../lib/entrySources';
import { DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';
import { SANDPACK_TEMPLATES } from '../../lib/sandpack';
import { jsonToStringRecord } from '../../lib/stacks';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { AdminEntryPreview } from '../../components/admin/AdminEntryPreview';
import { AdminKeyValueList } from '../../components/admin/AdminKeyValueList';
import { AdminSourceList } from '../../components/admin/AdminSourceList';
import { readEntryFields, type EntryFormFields } from '../../components/admin/entryFormFields';
import { recordToPairs, type KeyValuePair } from '../../components/admin/keyValuePairs';
import { sourcesToRows, type SourceRow } from '../../components/admin/sourceRows';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Typo } from '../../components/ui/Typo';

/**
 * Fiche dont la saisie est reprise pour en créer une autre (duplication).
 *
 * Ce sont des valeurs de départ, rien de plus : aucun lien n'est gardé avec la
 * fiche d'origine, et `published` n'en fait pas partie — une copie naît
 * brouillon, comme toute création.
 *
 * Les sources sont reprises (une copie part du même document). La date de
 * vérification et la version ne le sont pas : une copie n'a pas été vérifiée.
 */
export type AdminEntryFormSource = {
  categoryId: string;
  title: string;
  kind: AdminEntryKind;
  summary: string;
  bodyMdx: string;
  difficulty: AdminEntryDifficulty;
  tags: string;
  template: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  sources: EntrySource[];
};

type AdminEntryFormProps =
  | {
      mode: 'create';
      categories: AdminCategoryListItem[];
      /** Absent : formulaire vierge. */
      source?: AdminEntryFormSource;
      onSuccess: () => void;
    }
  | {
      mode: 'edit';
      entryId: string;
      categoryLabel: string;
      initialTitle: string;
      initialKind: AdminEntryKind;
      initialSummary: string;
      initialBodyMdx: string;
      initialDifficulty: AdminEntryDifficulty;
      initialTags: string;
      initialPublished: boolean;
      initialTemplate: string;
      initialFiles: Record<string, string>;
      initialDependencies: Record<string, string>;
      initialSources: EntrySource[];
      /** `AAAA-MM-JJ`, ou `null` : la fiche n'a pas de date de vérification. */
      initialVerifiedOn: string | null;
      initialVerifiedVersion: string;
      onSuccess: () => void;
    };

/**
 * Valeurs de départ des champs, quel que soit le mode : la fiche existante en
 * modification, la fiche source en duplication, sinon les valeurs vides. Les
 * champs lisent ensuite `initial.title`, sans savoir d'où vient la valeur.
 */
type InitialValues = {
  title: string;
  /** `undefined` : aucun type choisi (création sans source). */
  kind: AdminEntryKind | undefined;
  summary: string;
  bodyMdx: string;
  difficulty: AdminEntryDifficulty;
  tags: string;
  template: string;
  files: Record<string, string> | undefined;
  dependencies: Record<string, string> | undefined;
  sources: EntrySource[];
  verifiedOn: string;
  verifiedVersion: string;
};

function initialValues(props: AdminEntryFormProps): InitialValues {
  if (props.mode === 'edit') {
    return {
      title: props.initialTitle,
      kind: props.initialKind,
      summary: props.initialSummary,
      bodyMdx: props.initialBodyMdx,
      difficulty: props.initialDifficulty,
      tags: props.initialTags,
      template: props.initialTemplate || 'react-ts',
      files: props.initialFiles,
      dependencies: props.initialDependencies,
      sources: props.initialSources,
      verifiedOn: props.initialVerifiedOn ?? '',
      verifiedVersion: props.initialVerifiedVersion,
    };
  }

  const { source } = props;

  return {
    title: source?.title ?? '',
    kind: source?.kind,
    summary: source?.summary ?? '',
    bodyMdx: source?.bodyMdx ?? '',
    difficulty: source?.difficulty ?? 'BEGINNER',
    tags: source?.tags ?? '',
    template: source?.template || 'react-ts',
    files: source?.files,
    dependencies: source?.dependencies,
    sources: source?.sources ?? [],
    verifiedOn: '',
    verifiedVersion: '',
  };
}

export function AdminEntryForm(props: AdminEntryFormProps) {
  const { mode, onSuccess } = props;
  const isEdit = mode === 'edit';
  const initial = initialValues(props);
  const { error, pending, setError, submit } = useAdminSubmit({
    success: isEdit ? 'Fiche enregistrée' : 'Fiche créée',
    failure: isEdit ? 'Impossible de modifier la fiche' : 'Impossible de créer la fiche',
    onSuccess,
  });

  /**
   * Fichiers du playground, dépendances npm et sources sont des listes
   * modifiables : elles ne peuvent pas venir de `FormData`, d'où un `useState`
   * pour ces trois champs seulement (le reste du formulaire est non contrôlé).
   */
  const [files, setFiles] = useState<KeyValuePair[]>(() => recordToPairs(initial.files));
  const [dependencies, setDependencies] = useState<KeyValuePair[]>(() =>
    recordToPairs(initial.dependencies),
  );
  const [sources, setSources] = useState<SourceRow[]>(() => sourcesToRows(initial.sources));

  /**
   * Édition ou aperçu : deux affichages du même formulaire, pas deux pages.
   *
   * `snapshot` est la photographie de la saisie prise à la demande d'aperçu.
   * Elle ne suit pas la frappe : colorer le code et relancer le playground à
   * chaque caractère ferait clignoter l'aperçu. Elle n'est ni enregistrée ni
   * envoyée, et disparaît au retour à l'édition.
   *
   * L'état s'appelle `view` et non `mode` : `mode` est déjà la prop qui
   * distingue création et modification.
   */
  const formRef = useRef<HTMLFormElement>(null);
  // Relie le bouton d'enregistrement, placé hors du `<form>`, à son formulaire.
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [snapshot, setSnapshot] = useState<EntryFormFields | null>(null);

  // Une erreur se lit à côté des champs : tant qu'il y en a une, l'affichage
  // est celui de l'édition. La vue affichée est **calculée** à chaque rendu
  // plutôt que recopiée dans `view` par un effet : une seule source de vérité,
  // donc aucun rendu intermédiaire où l'aperçu resterait affiché avec l'erreur.
  const displayedView = error !== null ? 'edit' : view;
  const preview = displayedView === 'preview' ? snapshot : null;
  const isPreview = preview !== null;

  // Le formulaire est long et le message s'affiche en bas : sans défilement,
  // une demande d'aperçu refusée semblerait ne rien faire. `nearest` ne bouge
  // rien quand le message est déjà à l'écran (erreur d'enregistrement, le
  // bouton est juste dessous).
  useEffect(() => {
    if (error !== null) {
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [error]);

  function showEdit() {
    setView('edit');
    setSnapshot(null);
  }

  /** Aperçu refusé : le message s'affiche et le formulaire reste en édition. */
  function refusePreview(message: string) {
    showEdit();
    setError(message);
    // Même message qu'à la demande précédente : l'état ne change pas, l'effet
    // ci-dessus ne rejoue pas. Le message est déjà dans la page, on y revient.
    errorRef.current?.scrollIntoView({ block: 'nearest' });
  }

  function showPreview() {
    const form = formRef.current;
    // Déjà en aperçu : la photographie affichée ne change pas d'identité.
    if (form === null || isPreview) {
      return;
    }

    setError(null);

    // Même lecture qu'à l'enregistrement : l'aperçu montre exactement ce qui
    // serait envoyé, et une liste mal remplie donne le même message.
    const result = readEntryFields(form, files, dependencies, sources);
    if (!result.ok) {
      refusePreview(result.message);
      return;
    }

    // À la création, aucun type n'est choisi par défaut : le champ lu est alors
    // une chaîne vide, que le typage ne voit pas. Le type décide du libellé
    // affiché et de la présence du playground, l'aperçu ne peut pas l'inventer.
    if (!Object.hasOwn(KIND_LABEL, result.fields.kind)) {
      refusePreview('Un type est requis pour afficher l’aperçu.');
      return;
    }

    setSnapshot(result.fields);
    setView('preview');
  }

  function handleSubmit(form: HTMLFormElement) {
    // Un échec précédent a ramené l'affichage en édition sans modifier `view`.
    // Il faut l'acter avant d'envoyer : `submit` efface l'erreur, et l'ancien
    // aperçu, pris avant les corrections, reviendrait à l'écran.
    if (!isPreview) {
      showEdit();
    }

    // La lecture de la saisie (normalisation, validation des deux listes) vit
    // dans `readEntryFields`. Une lecture invalide s'arrête ici, avant tout
    // appel réseau, avec le message à afficher.
    const result = readEntryFields(form, files, dependencies, sources);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    const { fields, categoryId } = result;

    // La question n'est posée qu'au **passage** en ligne : case « Publié »
    // cochée alors que la fiche ne l'était pas (une création part toujours d'un
    // brouillon). Un brouillon s'enregistre sans question, et une fiche déjà
    // publiée ne redemande rien : une confirmation répétée se valide sans être
    // lue. Refus : rien n'est envoyé, la saisie reste telle quelle.
    //
    // C'est une aide, pas un contrôle : elle n'ouvre aucun droit. Le serveur
    // décide seul si la publication est autorisée (rôle `SUPER_ADMIN`).
    const wasPublished = props.mode === 'edit' && props.initialPublished;
    if (fields.published && !wasPublished) {
      const gaps = publicationGaps({
        ...fields,
        files: jsonToStringRecord(fields.files),
        sourceCount: fields.sources.length,
      });
      if (gaps.length > 0 && !window.confirm(publicationQuestion(gaps))) {
        return;
      }
    }

    void submit(() =>
      props.mode === 'edit'
        ? updateAdminEntry(props.entryId, fields)
        : createAdminEntry({ categoryId, ...fields }),
    );
  }

  return (
    // Le `<form>` ne contient que les champs. Commandes, aperçu, message et
    // bouton d'enregistrement sont ses voisins : le playground de l'aperçu rend
    // son propre `<form>` (« Open in CodeSandbox »), et un formulaire dans un
    // formulaire est du HTML invalide. Rien de l'aperçu ne peut ainsi envoyer
    // la fiche. L'aperçu prend la largeur d'une fiche publique (`max-w-3xl`),
    // pour que tableaux et blocs de code se replient au même endroit.
    <div className={`flex flex-col gap-4 ${isPreview ? 'max-w-3xl' : 'max-w-2xl'}`}>
      {/* `aria-pressed` annonce la vue courante aux lecteurs d'écran. */}
      <div role="group" aria-label="Affichage de la fiche" className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={isPreview ? 'ghost' : 'secondary'}
          aria-pressed={!isPreview}
          onPress={showEdit}
        >
          <PencilSimpleIcon className="size-4" />
          Édition
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isPreview ? 'secondary' : 'ghost'}
          aria-pressed={isPreview}
          onPress={showPreview}
        >
          <EyeIcon className="size-4" />
          Aperçu
        </Button>
      </div>

      {/* Les champs sont **masqués**, jamais démontés. Le formulaire est non
          contrôlé : sa saisie vit dans le DOM, et un champ démonté la perdrait.
          Un élément masqué (`hidden` : `display: none`) reste dans le DOM, donc
          `FormData` le lit toujours et l'enregistrement fonctionne depuis
          l'aperçu. */}
      <Form
        ref={formRef}
        id={formId}
        className={isPreview ? 'hidden' : 'flex flex-col gap-4'}
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(event.currentTarget);
        }}
      >
        {props.mode === 'create' ? (
          <AdminSelect
            name="categoryId"
            label="Catégorie parente"
            isRequired
            placeholder="Choisir une catégorie"
            defaultValue={props.source?.categoryId}
            items={props.categories.map((category) => ({
              id: category.id,
              label: `${category.stack.name} / ${category.name}`,
            }))}
          />
        ) : (
          <Typo variant="small" as="p">
            Catégorie parente : {props.categoryLabel}
          </Typo>
        )}
        <TextField
          isRequired
          name="title"
          defaultValue={initial.title}
          minLength={2}
          autoComplete="off"
        >
          <Label>Titre</Label>
          <Input />
          <FieldError />
        </TextField>
        <AdminSelect
          name="kind"
          label="Type"
          isRequired
          defaultValue={initial.kind}
          placeholder="Choisir un type"
          items={Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label }))}
        />
        <TextField name="summary" defaultValue={initial.summary}>
          <Label>Résumé (optionnel)</Label>
          <TextArea />
          <FieldError />
        </TextField>
        <TextField name="bodyMdx" defaultValue={initial.bodyMdx}>
          <Label>Corps (optionnel)</Label>
          <TextArea rows={8} />
          <FieldError />
        </TextField>
        <AdminSelect
          name="difficulty"
          label="Difficulté"
          defaultValue={initial.difficulty}
          items={Object.entries(DIFFICULTY_LABEL).map(([id, label]) => ({ id, label }))}
        />
        <TextField name="tags" defaultValue={initial.tags} autoComplete="off">
          <Label>Étiquettes (optionnel, séparées par des virgules)</Label>
          <Input />
          <FieldError />
        </TextField>
        <AdminSourceList rows={sources} onChange={setSources} />
        {/* La date n'a pas de valeur par défaut : « vérifiée le » est une
            déclaration. Elle n'avance que si elle est saisie, jamais parce
            qu'une faute de frappe a été corrigée. */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <TextField
            className="w-full sm:w-52 sm:shrink-0"
            name="verifiedOn"
            type="date"
            defaultValue={initial.verifiedOn}
          >
            <Label>Vérifiée le (optionnel)</Label>
            <Input max={todayAsDay()} />
            <FieldError />
          </TextField>
          <TextField
            className="w-full sm:min-w-0 sm:flex-1"
            name="verifiedVersion"
            defaultValue={initial.verifiedVersion}
            maxLength={60}
            autoComplete="off"
          >
            <Label>Version vérifiée (optionnel)</Label>
            <Input placeholder="React 19" />
            <FieldError />
          </TextField>
        </div>
        <Checkbox
          name="published"
          value="on"
          defaultSelected={props.mode === 'edit' ? props.initialPublished : false}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>Publié</Label>
          </Checkbox.Content>
        </Checkbox>
        <AdminSelect
          name="template"
          label="Modèle Sandpack"
          defaultValue={initial.template}
          items={SANDPACK_TEMPLATES.map((id) => ({ id, label: id }))}
        />
        <AdminKeyValueList
          title="Fichiers du playground"
          description="Un fichier = un chemin et son code, sans JSON."
          addLabel="Ajouter un fichier"
          emptyLabel="Aucun fichier. Le playground n’apparaîtra pas sur la fiche."
          keyLabel="Chemin"
          keyPlaceholder="/App.tsx"
          valueLabel="Code"
          valuePlaceholder={'import { useState } from "react";\n'}
          valueRows={12}
          pairs={files}
          onChange={setFiles}
        />
        <AdminKeyValueList
          title="Dépendances npm"
          description="Paquet et version, comme dans package.json."
          addLabel="Ajouter une dépendance"
          emptyLabel="Aucune dépendance supplémentaire."
          keyLabel="Paquet"
          keyPlaceholder="react"
          valueLabel="Version"
          valuePlaceholder="^19.0.0"
          compact
          pairs={dependencies}
          onChange={setDependencies}
        />
      </Form>

      {/* L'aperçu, lui, est démonté au retour à l'édition : cela libère
          l'iframe du playground. */}
      {isPreview ? <AdminEntryPreview fields={preview} /> : null}

      {error ? (
        <div ref={errorRef}>
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      ) : null}

      {/* `form` : le bouton envoie le formulaire sans en être un descendant. Il
          reste ainsi visible dans les deux vues. */}
      <Button
        type="submit"
        form={formId}
        variant="primary"
        className="self-start"
        isDisabled={pending}
      >
        {pending
          ? isEdit
            ? 'Enregistrement…'
            : 'Création…'
          : isEdit
            ? 'Enregistrer'
            : 'Créer la fiche'}
      </Button>
    </div>
  );
}
