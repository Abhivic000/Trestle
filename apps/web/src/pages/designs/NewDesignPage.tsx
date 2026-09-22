import { useEffect } from 'react';
import {
  availabilityTargetLabels,
  availabilityTargets,
  budgetTierLabels,
  budgetTiers,
  complianceNeedLabels,
  complianceNeeds,
  priorityLevels,
  projectTypeLabels,
  projectTypes,
  requirementsSchema,
  trafficShapeLabels,
  trafficShapes,
  type Requirements,
  type RequirementsInput,
} from '@trestle/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { ChoiceGroup, Field, TagListInput } from './intake-fields';

const DRAFT_KEY = 'trestle:intake-draft';

const defaultValues: RequirementsInput = {
  projectType: 'web_app',
  features: [],
  dailyActiveUsers: 10_000,
  trafficShape: 'read_heavy',
  latencySensitivity: 'medium',
  consistency: 'eventual',
  availability: '99.9',
  budget: 'startup',
  compliance: [],
  constraints: '',
  notes: '',
};

/** Reads the saved draft so a refresh doesn't lose a form's worth of typing. */
function loadDraft(): RequirementsInput {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return defaultValues;
    const parsed = requirementsSchema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : defaultValues;
  } catch {
    return defaultValues;
  }
}

export function NewDesignPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const {
    register,
    control,
    handleSubmit,
    subscribe,
    watch,
    formState: { errors },
    // Three types: what the form holds while editing, the resolver context, and
    // what a valid submit produces (defaults filled in).
  } = useForm<RequirementsInput, unknown, Requirements>({
    resolver: zodResolver(requirementsSchema),
    defaultValues: loadDraft(),
    mode: 'onSubmit',
  });

  // Keep a local draft up to date (browser only; never sent anywhere). Subscribing
  // avoids re-rendering the whole form on every keystroke.
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
          } catch {
            // Private mode or blocked storage: drafts are a convenience, not a requirement.
          }
        },
      }),
    [subscribe],
  );

  const projectType = watch('projectType');

  async function onSubmit(requirements: Requirements) {
    const project = await createProject.mutateAsync(requirements);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    await navigate(paths.design(project.id));
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <title>New design · Trestle</title>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Button asChild variant="ghost" className="-ml-2.5 text-muted-foreground">
          <Link to={paths.designs}>
            <ArrowLeft data-icon="inline-start" />
            My designs
          </Link>
        </Button>
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">Describe your project</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The more detail you give, the more accurate and grounded your generated design will be.
        </p>

        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="mt-8 flex flex-col gap-7"
          noValidate
        >
          <Field label="Project type" error={errors.projectType?.message}>
            <Controller
              control={control}
              name="projectType"
              render={({ field }) => (
                <ChoiceGroup
                  name="projectType"
                  value={field.value}
                  onChange={field.onChange}
                  options={projectTypes.map((type) => ({
                    value: type,
                    label: projectTypeLabels[type],
                  }))}
                />
              )}
            />
          </Field>

          {projectType === 'other' && (
            <Field
              label="What kind of project is it?"
              htmlFor="projectTypeOther"
              error={errors.projectTypeOther?.message}
            >
              <Input
                id="projectTypeOther"
                className="h-10"
                placeholder="e.g. Fleet tracking platform"
                {...register('projectTypeOther')}
              />
            </Field>
          )}

          <Field
            label="Core features"
            htmlFor="feature-input"
            help="One per entry. Press Enter or click Add."
            error={errors.features?.message}
          >
            <Controller
              control={control}
              name="features"
              render={({ field }) => (
                <TagListInput
                  inputId="feature-input"
                  values={field.value}
                  onChange={field.onChange}
                  placeholder="e.g. Playlists, offline downloads"
                />
              )}
            />
          </Field>

          <div className="grid gap-7 sm:grid-cols-2">
            <Field
              label="Daily active users"
              htmlFor="dailyActiveUsers"
              help="A rough number is fine."
              error={errors.dailyActiveUsers?.message}
            >
              <Input
                id="dailyActiveUsers"
                type="number"
                min={1}
                className="h-10"
                {...register('dailyActiveUsers', { valueAsNumber: true })}
              />
            </Field>

            <Field label="Traffic shape" error={errors.trafficShape?.message}>
              <Controller
                control={control}
                name="trafficShape"
                render={({ field }) => (
                  <ChoiceGroup
                    name="trafficShape"
                    value={field.value}
                    onChange={field.onChange}
                    options={trafficShapes.map((shape) => ({
                      value: shape,
                      label: trafficShapeLabels[shape],
                    }))}
                  />
                )}
              />
            </Field>
          </div>

          <Field
            label="How sensitive is it to slow responses?"
            error={errors.latencySensitivity?.message}
          >
            <Controller
              control={control}
              name="latencySensitivity"
              render={({ field }) => (
                <ChoiceGroup
                  name="latencySensitivity"
                  value={field.value}
                  onChange={field.onChange}
                  options={priorityLevels.map((level) => ({
                    value: level,
                    label: { low: 'Not very', medium: 'Somewhat', high: 'Very' }[level],
                  }))}
                />
              )}
            />
          </Field>

          <Field
            label="Data freshness"
            help="Strong means everyone must see the same data immediately; eventual allows a short delay."
            error={errors.consistency?.message}
          >
            <Controller
              control={control}
              name="consistency"
              render={({ field }) => (
                <ChoiceGroup
                  name="consistency"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'eventual' as const, label: 'Eventual is fine' },
                    { value: 'strong' as const, label: 'Must be immediate' },
                  ]}
                />
              )}
            />
          </Field>

          <Field label="Availability target" error={errors.availability?.message}>
            <Controller
              control={control}
              name="availability"
              render={({ field }) => (
                <ChoiceGroup
                  name="availability"
                  value={field.value}
                  onChange={field.onChange}
                  options={availabilityTargets.map((target) => ({
                    value: target,
                    label: availabilityTargetLabels[target],
                  }))}
                />
              )}
            />
          </Field>

          <Field label="Budget" error={errors.budget?.message}>
            <Controller
              control={control}
              name="budget"
              render={({ field }) => (
                <ChoiceGroup
                  name="budget"
                  value={field.value}
                  onChange={field.onChange}
                  options={budgetTiers.map((tier) => ({
                    value: tier,
                    label: budgetTierLabels[tier],
                  }))}
                />
              )}
            />
          </Field>

          <Field label="Compliance needs" help="Leave empty if none apply.">
            <Controller
              control={control}
              name="compliance"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {complianceNeeds.map((need) => {
                    const selected = field.value ?? [];
                    const checked = selected.includes(need);
                    return (
                      <label
                        key={need}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-brand bg-brand-subtle text-foreground'
                            : 'bg-elevated text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            field.onChange(
                              checked
                                ? selected.filter((item) => item !== need)
                                : [...selected, need],
                            );
                          }}
                        />
                        {complianceNeedLabels[need]}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </Field>

          <Field
            label="Existing constraints"
            htmlFor="constraints"
            help="Optional. e.g. must run on AWS, team knows Python."
            error={errors.constraints?.message}
          >
            <Textarea id="constraints" rows={2} {...register('constraints')} />
          </Field>

          <Field
            label="Anything else"
            htmlFor="notes"
            help="Optional. Anything the form didn't ask about."
            error={errors.notes?.message}
          >
            <Textarea id="notes" rows={3} {...register('notes')} />
          </Field>

          {createProject.isError && (
            <p role="alert" className="text-sm text-danger">
              Could not create the design:{' '}
              {createProject.error instanceof Error ? createProject.error.message : 'unknown error'}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link to={paths.designs}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-10 font-semibold"
              disabled={createProject.isPending}
            >
              {createProject.isPending ? 'Creating…' : 'Create design'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
