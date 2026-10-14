import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Description,
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
import {
  needsPublicationQuestion,
  publicationGaps,
  publicationQuestion,
} from '../../lib/entryChecks';
import type { EntryImageAdmin } from '../../lib/entryImages';
import { todayAsDay, type EntrySource } from '../../lib/entrySources';
import { DIFFICULTY_LABEL, KIND_LABEL } from '../../lib/labels';
import {
  MAX_PLAYGROUND_TEXT_LENGTH,
  PLAYGROUND_ENVIRONMENTS,
  environmentLabel,
  isPythonTemplate,
} from '../../lib/playgroundEnvironments';
import { jsonToStringRecord, type EntryLab } from '../../lib/stacks';
import { useAdminSubmit } from '../../components/admin/useAdminSubmit';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { AdminEntryImages } from '../../components/admin/AdminEntryImages';
import { AdminEntryPreview } from '../../components/admin/AdminEntryPreview';
import { AdminLabEditor } from '../../components/admin/AdminLabEditor';
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
  playgroundInput: string;
  playgroundExpectedOutput: string;
  sources: EntrySource[];
  /** Reprise comme les sources : une copie part du même laboratoire. */
  lab: EntryLab | null;
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
      initialPlaygroundInput: string;
      initialPlaygroundExpectedOutput: string;
      initialSources: EntrySource[];
      initialLab: EntryLab | null;
      /** `AAAA-MM-JJ`, ou `null` : la fiche n'a pas de date de vérification. */
      initialVerifiedOn: string | null;
      initialVerifiedVersion: string;
      /** Images déjà envoyées pour la fiche (spec 016). */
      initialImages: EntryImageAdmin[];
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
  playgroundInput: string;
  playgroundExpectedOutput: string;
  sources: EntrySource[];
  lab: EntryLab | null;
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
      playgroundInput: props.initialPlaygroundInput,
      playgroundExpectedOutput: props.initialPlaygroundExpectedOutput,
      sources: props.initialSources,
      lab: props.initialLab,
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
    playgroundInput: source?.playgroundInput ?? '',
    playgroundExpectedOutput: source?.playgroundExpectedOutput ?? '',
    sources: source?.sources ?? [],
    lab: source?.lab ?? null,
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
  // Laboratoire (spec 018) : fichiers et case suivie pour masquer les champs.
  const [labFiles, setLabFiles] = useState<KeyValuePair[]>(() => recordToPairs(initial.lab?.files));
  const [labEnabled, setLabEnabled] = useState(initial.lab !== null);
  // Suivi du choix d'environnement (le `<select>` reste non contrôlé) : en
  // Python, les dépendances sont masquées et l'entrée et la sortie attendue
  // apparaissent.
  const [template, setTemplate] = useState(initial.template);
  const isPython = isPythonTemplate(template);

  /**
   * Images de la fiche (spec 016). Elles ne passent pas par l'enregistrement :
   * chaque envoi, modification ou retrait part aussitôt à l'API, et la liste
   * suit la réponse. Une création n'en a pas : l'image a besoin d'une fiche
   * existante.
   */
  const [images, setImages] = useState<EntryImageAdmin[]>(() =>
    props.mode === 'edit' ? props.initialImages : [],
  );
  const imageIds = images.map((image) => image.id);

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
    const result = readEntryFields(form, files, dependencies, sources, labFiles);
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
    const result = readEntryFields(form, files, dependencies, sources, labFiles);
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
        imageIds,
      });
      if (
        needsPublicationQuestion(gaps, fields.lab !== null) &&
        !window.confirm(publicationQuestion(gaps, fields.lab !== null))
      ) {
        return;
      }
    }

    void submit(() =>
      props.mode === 'edit'
        ? updateAdminEntry(props.entryId, fields)
        : // Création : « pas de laboratoire » = champ absent, pas `null`.
          createAdminEntry({ categoryId, ...fields, lab: fields.lab ?? undefined }),
    );
  }

  /** Le champ « Corps », lu dans le DOM : le formulaire est non contrôlé. */
  function bodyField(): HTMLTextAreaElement | null {
    const field = formRef.current?.elements.namedItem('bodyMdx');
    return field instanceof HTMLTextAreaElement ? field : null;
  }

  /**
   * Insère la référence d'une image au curseur du corps, seule sur sa ligne
   * (une image seule sur sa ligne s'affiche en bloc). `setRangeText` modifie
   * la valeur sans passer par React ; l'événement `input` qui suit la lui
   * signale, comme une frappe au clavier.
   */
  function insertInBody(markdown: string) {
    const field = bodyField();
    if (field === null) {
      return;
    }

    const before = field.value.slice(0, field.selectionStart);
    const after = field.value.slice(field.selectionEnd);
    const lead =
      before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';

    field.focus();
    field.setRangeText(
      `${lead}${markdown}${trail}`,
      field.selectionStart,
      field.selectionEnd,
      'end',
    );
    field.dispatchEvent(new Event('input', { bubbles: true }));
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
        {props.mode === 'edit' ? (
          <AdminEntryImages
            entryId={props.entryId}
            images={images}
            onChange={setImages}
            onInsert={insertInBody}
            readBody={() => bodyField()?.value ?? ''}
          />
        ) : (
          <Typo variant="small" as="p">
            Enregistrer le brouillon pour ajouter des images.
          </Typo>
        )}
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
          label="Environnement du playground"
          defaultValue={initial.template}
          items={PLAYGROUND_ENVIRONMENTS.map((id) => ({ id, label: environmentLabel(id) }))}
          onChange={setTemplate}
        />
        <AdminKeyValueList
          title="Fichiers du playground"
          description="Un fichier = un chemin et son code, sans JSON."
          addLabel="Ajouter un fichier"
          emptyLabel="Aucun fichier. Le playground n’apparaîtra pas sur la fiche."
          keyLabel="Chemin"
          keyPlaceholder={isPython ? 'main.py' : '/App.tsx'}
          valueLabel="Code"
          valuePlaceholder={isPython ? 'print("Bonjour")\n' : 'import { useState } from "react";\n'}
          valueRows={12}
          pairs={files}
          onChange={setFiles}
        />
        {/* Champs masqués, jamais démontés : le formulaire est non contrôlé, et
            un retour à un environnement web retrouve la saisie. En Python, les
            dépendances sont envoyées vides (`readEntryFields`) ; l'entrée et la
            sortie attendue restent envoyées pour un modèle web, ignorées à
            l'affichage. */}
        <div className={isPython ? 'flex flex-col gap-4' : 'hidden'}>
          <Typo variant="small" as="p">
            L’atelier exécute main.py ; les autres fichiers .py sont importables. Seule la
            bibliothèque standard de Python est disponible.
          </Typo>
          <TextField
            name="playgroundInput"
            defaultValue={initial.playgroundInput}
            maxLength={MAX_PLAYGROUND_TEXT_LENGTH}
          >
            <Label>Entrée de l’atelier (optionnel)</Label>
            <TextArea rows={4} className="font-mono" />
            <Description>Une ligne par appel à input().</Description>
            <FieldError />
          </TextField>
          <TextField
            name="playgroundExpectedOutput"
            defaultValue={initial.playgroundExpectedOutput}
            maxLength={MAX_PLAYGROUND_TEXT_LENGTH}
          >
            <Label>Sortie attendue (optionnel)</Label>
            <TextArea rows={4} className="font-mono" />
            <Description>
              Remplie, elle fait apparaître « Vérifier » sur la fiche : la sortie du script, lancé
              avec l’entrée ci-dessus, lui est comparée.
            </Description>
            <FieldError />
          </TextField>
        </div>
        <div className={isPython ? 'hidden' : undefined}>
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
        </div>
        <AdminLabEditor
          initial={initial.lab}
          enabled={labEnabled}
          onEnabledChange={setLabEnabled}
          files={labFiles}
          onFilesChange={setLabFiles}
        />
      </Form>

      {/* L'aperçu, lui, est démonté au retour à l'édition : cela libère
          l'iframe du playground. */}
      {isPreview ? <AdminEntryPreview fields={preview} images={images} /> : null}

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
