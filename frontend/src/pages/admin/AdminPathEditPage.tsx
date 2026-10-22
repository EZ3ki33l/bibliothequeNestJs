import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import { ArrowDownIcon, ArrowUpIcon, LockOpenIcon, TrashIcon } from '@phosphor-icons/react';
import {
  addAdminPathModule,
  addAdminPathStep,
  adminPathLabel,
  AdminRefusedError,
  attachAdminSubPath,
  createAdminSubPath,
  detachAdminSubPath,
  listAllAdminPaths,
  reorderAdminSubPaths,
  deleteAdminPath,
  deleteAdminPathModule,
  deleteAdminPathStep,
  getAdminPath,
  reorderAdminPathModules,
  reorderAdminPathSteps,
  updateAdminPath,
  updateAdminPathModule,
  updateAdminPathStep,
  type AdminPathDetail,
  type AdminPathModule,
  type AdminPathWriteResult,
  type AdminSubPath,
} from '../../lib/admin';
import { freeModuleId, pathPublicationGaps, pathPublicationQuestion } from '../../lib/pathChecks';
import { useAsyncData } from '../../lib/useAsyncData';
import { useConfirm } from '../../lib/confirm';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { AdminPathEntryPicker } from '../../components/admin/AdminPathEntryPicker';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';
import { Typo } from '../../components/ui/Typo';

/** Copie de `ids` où l'élément `index` a été déplacé de `delta` (−1 = monter). */
function moved(ids: string[], index: number, delta: -1 | 1): string[] {
  const next = [...ids];
  const target = index + delta;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Édition d'un parcours : métadonnées, puis composition (modules et étapes).
 *
 * Chaque action part immédiatement vers l'API, et le serveur répond avec le
 * parcours **entier** : l'écran remplace son état d'un bloc (`setData`). Il n'y a
 * donc jamais d'état « local » qui pourrait diverger de la base.
 *
 * Réordonner envoie l'ordre complet. Si la composition a changé ailleurs (autre
 * onglet), le serveur refuse (409) : l'écran affiche son message et recharge,
 * plutôt que d'écraser un ordre qu'il ne connaît pas.
 */
export function AdminPathEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: path,
    error,
    setData,
    reload,
  } = useAsyncData(
    () => (id ? getAdminPath(id) : Promise.resolve(null)),
    [id],
    'Impossible de charger le parcours',
  );

  /**
   * Lance une écriture qui renvoie le parcours. 404 et 409 signalent que
   * l'écran ne correspond plus à la base : on recharge après avoir affiché le
   * message du serveur. Une saisie invalide (400) n'a pas besoin de rechargement.
   */
  async function apply(action: () => Promise<AdminPathWriteResult>, success?: string) {
    if (busy) return false;
    setBusy(true);
    setActionError(null);

    try {
      const result = await action();

      if (!result.ok) {
        setActionError(result.message);
        if (result.status === 404 || result.status === 409) reload();
        return false;
      }

      setData(result.path);
      if (success) toast.success(success);
      return true;
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Action impossible');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Suppression d'un module ou d'une étape : 204 sans corps, on recharge le parcours. */
  async function applyDelete(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setActionError(null);

    try {
      await action();
      toast.success(success);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setBusy(false);
      reload();
    }
  }

  async function onDeletePath(current: AdminPathDetail) {
    if (
      !(await confirm(
        `« ${current.name} », ses modules et ses étapes seront supprimés. Les fiches sont conservées.`,
        { title: 'Supprimer le parcours ?', confirmLabel: 'Supprimer', danger: true },
      ))
    ) {
      return;
    }

    try {
      await deleteAdminPath(current.id);
      toast.success('Parcours supprimé');
      navigate('/admin/parcours');
    } catch (caught) {
      toast.danger(
        caught instanceof AdminRefusedError
          ? caught.message
          : 'Impossible de supprimer le parcours',
      );
    }
  }

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (path === undefined) return <AdminFormSkeleton />;
  if (path === null) return <EmptyMessage>Ce parcours n’existe pas.</EmptyMessage>;

  const moduleIds = path.modules.map((module) => module.id);
  // Une fiche au plus une fois par parcours : le sélecteur les grise.
  const usedEntryIds = new Set(
    path.modules.flatMap((module) => module.steps.map((step) => step.entry.id)),
  );
  // Ce qu'un lecteur ne verra pas : calculé depuis le parcours affiché, donc
  // toujours à jour après un ajout, un retrait ou un réordonnancement.
  const gaps = pathPublicationGaps(path);
  // Un parcours a des modules **ou** des sous-parcours ; un sous-parcours n'en a pas.
  const canHoldModules = path.subPaths.length === 0;
  const canHoldSubPaths = path.parent === null && path.modules.length === 0;
  const subPathIds = path.subPaths.map((subPath) => subPath.id);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Parcours', to: '/admin/parcours' },
          ...(path.parent
            ? [{ label: path.parent.name, to: `/admin/parcours/${path.parent.id}/edit` }]
            : []),
          { label: path.name },
        ]}
      />
      <PageHeader
        title={`Modifier ${path.name}`}
        description={
          path.published ? `Publié sur /parcours/${path.slug}` : 'Brouillon : invisible côté public'
        }
        action={
          path.published ? (
            <Link to={`/parcours/${path.slug}`} className="text-sm underline">
              Voir la page publique
            </Link>
          ) : undefined
        }
      />

      {actionError ? (
        <div className="mb-6">
          <ErrorMessage>{actionError}</ErrorMessage>
        </div>
      ) : null}

      {path.parent && path.published && !path.parent.published ? (
        <Alert status="warning" className="mb-6 max-w-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Invisible tant que le parent est en brouillon</Alert.Title>
            <Alert.Description>
              Ce sous-parcours est publié, mais son parent « {path.parent.name} » ne l’est pas :
              aucun visiteur ne le voit, et son premier module n’est pas en accès libre.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {/* Rappel permanent, brouillon ou publié : la même liste que celle de la
          confirmation ci-dessous. Sur un parcours déjà en ligne, elle dit ce
          que les lecteurs ne voient pas. */}
      {gaps.length > 0 ? (
        <Alert status="warning" className="mb-6 max-w-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {path.published ? 'En ligne avec des manques' : 'Avant publication'}
            </Alert.Title>
            {/* Liste placée à côté du titre, pas dans `Alert.Description` :
                celui-ci rend un `<span>`, qui ne peut pas contenir de `<ul>`. */}
            <ul className="mt-1 list-disc pl-5 text-sm">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </Alert.Content>
        </Alert>
      ) : null}

      <PathMetaForm
        // Remonté à chaque version enregistrée : les champs repartent des valeurs du serveur.
        key={`${path.name}|${path.description}|${path.published}`}
        path={path}
        busy={busy}
        onSave={async (payload) => {
          // La question n'est posée qu'au **passage** en ligne, comme pour une
          // fiche : un parcours déjà publié s'enregistre sans redemander. Refus :
          // rien n'est envoyé, la saisie reste telle quelle. C'est un rappel,
          // pas un contrôle : le serveur décide seul qui publie.
          if (
            payload.published &&
            !path.published &&
            gaps.length > 0 &&
            !(await confirm(pathPublicationQuestion(gaps), {
              title: 'Publier le parcours ?',
              confirmLabel: 'Publier',
            }))
          ) {
            return false;
          }

          return apply(() => updateAdminPath(path.id, payload), 'Parcours enregistré');
        }}
      />

      {path.parent ? (
        <Typo variant="small" as="p" className="mt-8">
          Sous-parcours de{' '}
          <Link
            to={`/admin/parcours/${path.parent.id}/edit`}
            className="text-blueberry-light underline underline-offset-2"
          >
            {path.parent.name}
          </Link>
          .
        </Typo>
      ) : null}

      {canHoldSubPaths ? (
        <SubPathsSection
          path={path}
          busy={busy}
          onCreate={(payload) =>
            apply(
              () =>
                createAdminSubPath(path.id, {
                  name: payload.title,
                  description: payload.description,
                }),
              'Sous-parcours créé',
            )
          }
          onAttach={(childId) =>
            apply(() => attachAdminSubPath(path.id, childId), 'Parcours rattaché')
          }
          onMove={(index, delta) =>
            void apply(() => reorderAdminSubPaths(path.id, moved(subPathIds, index, delta)))
          }
          onDetach={async (subPath) => {
            const warning = subPath.published
              ? `« ${subPath.name} » est publié : il apparaîtra seul dans la liste des parcours.`
              : `« ${subPath.name} » redevient un parcours à part entière.`;
            if (
              !(await confirm(warning, {
                title: 'Détacher le sous-parcours ?',
                confirmLabel: 'Détacher',
              }))
            )
              return;
            void applyDelete(
              () => detachAdminSubPath(path.id, subPath.id),
              'Sous-parcours détaché',
            );
          }}
        />
      ) : null}

      {canHoldModules ? (
        <section aria-labelledby="path-modules" className="mt-12">
          <Typo variant="h3" as="h2" id="path-modules" className="mb-4">
            Modules
          </Typo>

          {path.modules.length === 0 ? (
            <EmptyMessage>Aucun module : ajouter un premier module ci-dessous.</EmptyMessage>
          ) : (
            <ol className="flex flex-col gap-6">
              {path.modules.map((module, index) => (
                <li key={module.id}>
                  <ModuleCard
                    module={module}
                    index={index}
                    freeAccess={
                      module.id === freeModuleId(path)
                        ? path.published
                          ? 'published'
                          : 'draft'
                        : null
                    }
                    isFirst={index === 0}
                    isLast={index === path.modules.length - 1}
                    busy={busy}
                    usedEntryIds={usedEntryIds}
                    onMove={(delta) =>
                      void apply(() =>
                        reorderAdminPathModules(path.id, moved(moduleIds, index, delta)),
                      )
                    }
                    onSave={(payload) =>
                      apply(
                        () => updateAdminPathModule(path.id, module.id, payload),
                        'Module enregistré',
                      )
                    }
                    onDelete={async () => {
                      const warning =
                        module.steps.length > 0
                          ? `« ${module.title} » et ses ${module.steps.length} étape(s) seront supprimés. Les fiches sont conservées.`
                          : `« ${module.title} » sera supprimé.`;
                      if (
                        !(await confirm(warning, {
                          title: 'Supprimer le module ?',
                          confirmLabel: 'Supprimer',
                          danger: true,
                        }))
                      )
                        return;
                      void applyDelete(
                        () => deleteAdminPathModule(path.id, module.id),
                        'Module supprimé',
                      );
                    }}
                    onAddStep={(entryId) =>
                      void apply(
                        () => addAdminPathStep(path.id, module.id, { entryId }),
                        'Étape ajoutée',
                      )
                    }
                    onMoveStep={(stepIndex, delta) =>
                      void apply(() =>
                        reorderAdminPathSteps(
                          path.id,
                          module.id,
                          moved(
                            module.steps.map((step) => step.id),
                            stepIndex,
                            delta,
                          ),
                        ),
                      )
                    }
                    onToggleOptional={(stepId, optional) =>
                      void apply(() => updateAdminPathStep(path.id, stepId, { optional }))
                    }
                    onRemoveStep={(stepId) =>
                      void applyDelete(() => deleteAdminPathStep(path.id, stepId), 'Étape retirée')
                    }
                  />
                </li>
              ))}
            </ol>
          )}

          <AddModuleForm
            busy={busy}
            onAdd={(payload) => apply(() => addAdminPathModule(path.id, payload), 'Module ajouté')}
          />
        </section>
      ) : null}

      <section className="border-border mt-12 border-t pt-6">
        <Button type="button" variant="danger-soft" onPress={() => void onDeletePath(path)}>
          Supprimer le parcours
        </Button>
      </section>
    </>
  );
}

type PathMetaFormProps = {
  path: AdminPathDetail;
  busy: boolean;
  onSave: (payload: { name: string; description: string; published: boolean }) => Promise<boolean>;
};

/** Nom, description et publication. Le slug suit le nom (calculé par le serveur). */
function PathMetaForm({ path, busy, onSave }: PathMetaFormProps) {
  return (
    <Form
      className="flex max-w-md flex-col gap-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void onSave({
          name: String(data.get('name') ?? '').trim(),
          description: String(data.get('description') ?? '').trim(),
          published: data.get('published') === 'on',
        });
      }}
    >
      <TextField
        isRequired
        name="name"
        defaultValue={path.name}
        minLength={2}
        maxLength={120}
        autoComplete="off"
      >
        <Label>Nom</Label>
        <Input />
        <FieldError />
      </TextField>
      <TextField name="description" defaultValue={path.description} maxLength={1000}>
        <Label>Description (optionnelle)</Label>
        <TextArea />
        <FieldError />
      </TextField>
      <Checkbox name="published" value="on" defaultSelected={path.published}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Publié</Label>
        </Checkbox.Content>
      </Checkbox>
      <Button type="submit" variant="primary" className="cta" isDisabled={busy}>
        Enregistrer
      </Button>
    </Form>
  );
}

type ModuleCardProps = {
  module: AdminPathModule;
  index: number;
  /**
   * Ce module est celui dont les fiches se lisent sans compte : dès maintenant
   * (`published`) ou une fois le parcours publié (`draft`). `null` sinon.
   */
  freeAccess: 'published' | 'draft' | null;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  usedEntryIds: ReadonlySet<string>;
  onMove: (delta: -1 | 1) => void;
  onSave: (payload: { title: string; description: string }) => Promise<boolean>;
  onDelete: () => void;
  onAddStep: (entryId: string) => void;
  onMoveStep: (stepIndex: number, delta: -1 | 1) => void;
  onToggleOptional: (stepId: string, optional: boolean) => void;
  onRemoveStep: (stepId: string) => void;
};

function ModuleCard({
  module,
  index,
  freeAccess,
  isFirst,
  isLast,
  busy,
  usedEntryIds,
  onMove,
  onSave,
  onDelete,
  onAddStep,
  onMoveStep,
  onToggleOptional,
  onRemoveStep,
}: ModuleCardProps) {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description);
  const dirty = title.trim() !== module.title || description.trim() !== module.description;

  return (
    <div className="border-border flex flex-col gap-5 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Typo variant="caption" className="text-blueberry-light pt-2 font-medium">
          Module {index + 1}
        </Typo>
        <div className="flex-1" />
        <MoveButtons
          label={`le module « ${module.title} »`}
          isFirst={isFirst}
          isLast={isLast}
          busy={busy}
          onMove={onMove}
        />
        <Button
          type="button"
          variant="danger-soft"
          size="sm"
          isIconOnly
          aria-label={`Supprimer le module « ${module.title} »`}
          isDisabled={busy}
          onPress={onDelete}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>

      {/* Le premier module visible d'un parcours publié ouvre ses fiches à
          tout le monde. L'éditeur le dit là où le module se compose : y
          placer une fiche, c'est la rendre lisible sans compte. Pictogramme
          et libellé, pour que l'indication ne repose pas sur la couleur. */}
      {freeAccess ? (
        <Typo variant="small" as="p" className="flex items-start gap-2">
          <LockOpenIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {freeAccess === 'published'
            ? 'Les fiches de ce module se lisent sans compte.'
            : 'Les fiches de ce module se liront sans compte une fois le parcours publié.'}
        </Typo>
      ) : null}

      <div className="flex max-w-md flex-col gap-3">
        <TextField value={title} onChange={setTitle} maxLength={120} autoComplete="off">
          <Label>Titre</Label>
          <Input />
        </TextField>
        <TextField value={description} onChange={setDescription} maxLength={500}>
          <Label>Description (optionnelle)</Label>
          <TextArea />
        </TextField>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-fit"
            isDisabled={busy || title.trim().length < 2}
            onPress={() => void onSave({ title: title.trim(), description: description.trim() })}
          >
            Enregistrer le module
          </Button>
        ) : null}
      </div>

      {module.steps.length === 0 ? (
        <Typo variant="small" as="p">
          Aucune étape dans ce module.
        </Typo>
      ) : (
        <ol className="flex flex-col gap-2">
          {module.steps.map((step, stepIndex) => (
            <li
              key={step.id}
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <span className="text-muted w-6 text-sm">{stepIndex + 1}.</span>
              <div className="min-w-0 flex-1">
                <Link to={`/admin/entries/${step.entry.id}/edit`} className="text-sm font-medium">
                  {step.entry.title}
                </Link>
                <Typo variant="caption">
                  {step.entry.category.stack.name} › {step.entry.category.name}
                </Typo>
              </div>
              {step.entry.published ? null : (
                <Chip size="sm" variant="soft" color="warning">
                  Brouillon (masquée)
                </Chip>
              )}
              <Checkbox
                isSelected={step.optional}
                isDisabled={busy}
                onChange={(optional) => onToggleOptional(step.id, optional)}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label>Facultative</Label>
                </Checkbox.Content>
              </Checkbox>
              <MoveButtons
                label={`l’étape « ${step.entry.title} »`}
                isFirst={stepIndex === 0}
                isLast={stepIndex === module.steps.length - 1}
                busy={busy}
                onMove={(delta) => onMoveStep(stepIndex, delta)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={busy}
                onPress={() => onRemoveStep(step.id)}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ol>
      )}

      <AdminPathEntryPicker
        excludedEntryIds={usedEntryIds}
        isDisabled={busy}
        onPick={(entry) => onAddStep(entry.id)}
      />
    </div>
  );
}

type MoveButtonsProps = {
  /** Complément du libellé accessible : « Monter le module « Bases » ». */
  label: string;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
};

/**
 * Boutons ↑ / ↓ plutôt qu'un glisser-déposer : utilisables au clavier et au
 * lecteur d'écran, et sans dépendance supplémentaire.
 */
function MoveButtons({ label, isFirst, isLast, busy, onMove }: MoveButtonsProps) {
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={`Monter ${label}`}
        isDisabled={busy || isFirst}
        onPress={() => onMove(-1)}
      >
        <ArrowUpIcon className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={`Descendre ${label}`}
        isDisabled={busy || isLast}
        onPress={() => onMove(1)}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    </div>
  );
}

type AddModuleFormProps = {
  busy: boolean;
  onAdd: (payload: { title: string; description: string }) => Promise<boolean>;
  /** Libellés : ceux d'un module par défaut, ceux d'un sous-parcours sinon. */
  heading?: string;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
};

/** Ajout d'un module (ou d'un sous-parcours) en fin de liste ; les champs se vident après succès. */
function AddModuleForm({
  busy,
  onAdd,
  heading = 'Nouveau module',
  label = 'Titre',
  placeholder = 'Les bases du web',
  submitLabel = 'Ajouter le module',
}: AddModuleFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Form
      className="border-border mt-6 flex max-w-md flex-col gap-3 rounded-xl border border-dashed p-4"
      validationBehavior="aria"
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd({ title: title.trim(), description: description.trim() }).then((ok) => {
          if (ok) {
            setTitle('');
            setDescription('');
          }
        });
      }}
    >
      <Typo variant="small" as="p" className="text-foreground font-medium">
        {heading}
      </Typo>
      <TextField
        isRequired
        value={title}
        onChange={setTitle}
        minLength={2}
        maxLength={120}
        autoComplete="off"
      >
        <Label>{label}</Label>
        <Input placeholder={placeholder} />
        <FieldError />
      </TextField>
      <TextField value={description} onChange={setDescription} maxLength={500}>
        <Label>Description (optionnelle)</Label>
        <TextArea />
      </TextField>
      <Button type="submit" variant="secondary" className="w-fit" isDisabled={busy}>
        {submitLabel}
      </Button>
    </Form>
  );
}

type SubPathsSectionProps = {
  path: AdminPathDetail;
  busy: boolean;
  onCreate: (payload: { title: string; description: string }) => Promise<boolean>;
  onAttach: (childId: string) => Promise<boolean>;
  onMove: (index: number, delta: -1 | 1) => void;
  onDetach: (subPath: AdminSubPath) => void;
};

/**
 * Sous-parcours d'un parent : liste ordonnée, création, rattachement d'un
 * parcours existant, détachement. Chaque sous-parcours se compose ensuite sur
 * sa propre page, comme un parcours ordinaire.
 */
function SubPathsSection({
  path,
  busy,
  onCreate,
  onAttach,
  onMove,
  onDetach,
}: SubPathsSectionProps) {
  // Rattachables : parcours de premier niveau, sans sous-parcours, autres que
  // celui-ci. Relu à chaque changement de la liste.
  const { data: candidates } = useAsyncData(
    async () =>
      (await listAllAdminPaths()).filter(
        (candidate) =>
          candidate.id !== path.id && candidate.parent === null && candidate.subPathCount === 0,
      ),
    [path.id, path.subPaths.map((subPath) => subPath.id).join()],
    'Impossible de charger les parcours',
  );

  return (
    <section aria-labelledby="path-sub-paths" className="mt-12">
      <Typo variant="h3" as="h2" id="path-sub-paths" className="mb-2">
        Sous-parcours
      </Typo>
      <Typo variant="small" as="p" className="mb-4 max-w-2xl">
        Pour découper une formation longue. Chaque sous-parcours a ses modules, sa page et son
        premier module en accès libre. Un parcours contient des modules ou des sous-parcours, pas
        les deux.
      </Typo>

      {path.subPaths.length === 0 ? (
        <EmptyMessage>Aucun sous-parcours.</EmptyMessage>
      ) : (
        <ol className="flex flex-col gap-2">
          {path.subPaths.map((subPath, index) => (
            <li
              key={subPath.id}
              className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <span className="text-muted w-6 text-sm">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <Link to={`/admin/parcours/${subPath.id}/edit`} className="text-sm font-medium">
                  {subPath.name}
                </Link>
                <Typo variant="caption">
                  {subPath.moduleCount} module(s) · {subPath.stepCount} étape(s)
                </Typo>
              </div>
              {subPath.published ? null : (
                <Chip size="sm" variant="soft" color="warning">
                  Brouillon (masqué)
                </Chip>
              )}
              <MoveButtons
                label={`le sous-parcours « ${subPath.name} »`}
                isFirst={index === 0}
                isLast={index === path.subPaths.length - 1}
                busy={busy}
                onMove={(delta) => onMove(index, delta)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isDisabled={busy}
                onPress={() => onDetach(subPath)}
              >
                Détacher
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <AddModuleForm
          busy={busy}
          onAdd={onCreate}
          heading="Nouveau sous-parcours"
          label="Nom"
          placeholder="Réseaux"
          submitLabel="Créer le sous-parcours"
        />
        <Form
          className="border-border mt-6 flex max-w-md flex-col gap-3 rounded-xl border border-dashed p-4"
          validationBehavior="aria"
          onSubmit={(event) => {
            event.preventDefault();
            const childId = String(new FormData(event.currentTarget).get('childId') ?? '');
            if (childId) void onAttach(childId);
          }}
        >
          <Typo variant="small" as="p" className="text-foreground font-medium">
            Rattacher un parcours existant
          </Typo>
          {candidates && candidates.length > 0 ? (
            <>
              <AdminSelect
                // Remonté après chaque rattachement : le choix repart à vide.
                key={path.subPaths.length}
                name="childId"
                label="Parcours"
                isRequired
                placeholder="Choisir un parcours"
                items={candidates.map((candidate) => ({
                  id: candidate.id,
                  label: adminPathLabel(candidate),
                }))}
              />
              <Button type="submit" variant="secondary" className="w-fit" isDisabled={busy}>
                Rattacher
              </Button>
            </>
          ) : (
            <Typo variant="small" as="p">
              {candidates
                ? 'Aucun parcours à rattacher : seul un parcours sans parent ni sous-parcours peut l’être.'
                : 'Chargement des parcours…'}
            </Typo>
          )}
        </Form>
      </div>
    </section>
  );
}
