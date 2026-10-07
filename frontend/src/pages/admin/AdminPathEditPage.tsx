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
  AdminRefusedError,
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
} from '../../lib/admin';
import { freeModuleId, pathPublicationGaps, pathPublicationQuestion } from '../../lib/pathChecks';
import { useAsyncData } from '../../lib/useAsyncData';
import { AdminFormSkeleton } from '../../components/admin/AdminFormSkeleton';
import { AdminPathEntryPicker } from '../../components/admin/AdminPathEntryPicker';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { EmptyMessage } from '../../components/ui/EmptyMessage';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { PageHeader } from '../../components/ui/PageHeader';

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
      !window.confirm(
        `Supprimer le parcours « ${current.name} », ses modules et ses étapes ? Les fiches sont conservées.`,
      )
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

  return (
    <>
      <Breadcrumbs items={[{ label: 'Parcours', to: '/admin/parcours' }, { label: path.name }]} />
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
        onSave={(payload) => {
          // La question n'est posée qu'au **passage** en ligne, comme pour une
          // fiche : un parcours déjà publié s'enregistre sans redemander. Refus :
          // rien n'est envoyé, la saisie reste telle quelle. C'est un rappel,
          // pas un contrôle : le serveur décide seul qui publie.
          if (
            payload.published &&
            !path.published &&
            gaps.length > 0 &&
            !window.confirm(pathPublicationQuestion(gaps))
          ) {
            return Promise.resolve(false);
          }

          return apply(() => updateAdminPath(path.id, payload), 'Parcours enregistré');
        }}
      />

      <section aria-labelledby="path-modules" className="mt-12">
        <h2 id="path-modules" className="mb-4 text-lg font-semibold">
          Modules
        </h2>

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
                  onDelete={() => {
                    const warning =
                      module.steps.length > 0
                        ? `Supprimer le module « ${module.title} » et ses ${module.steps.length} étape(s) ? Les fiches sont conservées.`
                        : `Supprimer le module « ${module.title} » ?`;
                    if (!window.confirm(warning)) return;
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
      <Button type="submit" variant="primary" isDisabled={busy}>
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
        <p className="text-muted pt-2 text-xs tracking-wide uppercase">Module {index + 1}</p>
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
        <p className="text-muted flex items-start gap-2 text-sm">
          <LockOpenIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {freeAccess === 'published'
            ? 'Les fiches de ce module se lisent sans compte.'
            : 'Les fiches de ce module se liront sans compte une fois le parcours publié.'}
        </p>
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
        <p className="text-muted text-sm">Aucune étape dans ce module.</p>
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
                <p className="text-muted text-xs">
                  {step.entry.category.stack.name} › {step.entry.category.name}
                </p>
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
};

/** Ajout d'un module en fin de parcours ; les champs se vident après succès. */
function AddModuleForm({ busy, onAdd }: AddModuleFormProps) {
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
      <p className="text-sm font-medium">Nouveau module</p>
      <TextField
        isRequired
        value={title}
        onChange={setTitle}
        minLength={2}
        maxLength={120}
        autoComplete="off"
      >
        <Label>Titre</Label>
        <Input placeholder="Les bases du web" />
        <FieldError />
      </TextField>
      <TextField value={description} onChange={setDescription} maxLength={500}>
        <Label>Description (optionnelle)</Label>
        <TextArea />
      </TextField>
      <Button type="submit" variant="secondary" className="w-fit" isDisabled={busy}>
        Ajouter le module
      </Button>
    </Form>
  );
}
