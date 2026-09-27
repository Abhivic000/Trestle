import { z } from 'zod';
import {
  changeProposalResponseSchema,
  componentComparisonsResponseSchema,
  createProjectRequestSchema,
  listProjectsResponseSchema,
  listVersionsResponseSchema,
  projectDetailSchema,
  type Design,
  type ProjectDetail,
  type Requirements,
} from '@trestle/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, ApiError } from './api';

/*
 * Server data lives in TanStack Query: it handles loading and error states,
 * caching and refreshing after a change, so pages don't repeat that logic.
 */

export const queryKeys = {
  projects: ['projects'] as const,
  project: (projectId: string) => ['projects', projectId] as const,
  versions: (projectId: string) => ['projects', projectId, 'versions'] as const,
  comparisons: (projectId: string, componentId: string) =>
    ['projects', projectId, 'components', componentId, 'comparisons'] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiGet('/projects', listProjectsResponseSchema, { signal }),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      apiGet(`/projects/${encodeURIComponent(projectId ?? '')}`, projectDetailSchema, { signal }),
    // A missing or someone else's design won't appear by retrying.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Version history for the drawer. */
export function useVersions(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.versions(projectId ?? ''),
    enabled: enabled && Boolean(projectId),
    queryFn: ({ signal }) =>
      apiGet(
        `/projects/${encodeURIComponent(projectId ?? '')}/versions`,
        listVersionsResponseSchema,
        { signal },
      ),
  });
}

/**
 * Real systems that solved the same problem as one component.
 *
 * Only fetched when the Compare tab is actually open, and kept for the session
 * once loaded: the library changes rarely, so clicking between components
 * should not re-run the search every time.
 */
export function useComponentComparisons(
  projectId: string | undefined,
  componentId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.comparisons(projectId ?? '', componentId ?? ''),
    enabled: enabled && Boolean(projectId) && Boolean(componentId),
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      apiGet(
        `/projects/${encodeURIComponent(projectId ?? '')}/components/${encodeURIComponent(componentId ?? '')}/comparisons`,
        componentComparisonsResponseSchema,
        { signal },
      ),
    // A component the server doesn't know about won't appear by retrying.
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Saves canvas edits as a new version. */
export function useSaveEdits(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (design: Design) =>
      apiPost(
        `/projects/${encodeURIComponent(projectId ?? '')}/edits`,
        { design },
        projectDetailSchema,
      ),
    onSuccess: (project: ProjectDetail) => {
      queryClient.setQueryData(queryKeys.project(project.id), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.versions(project.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/** Brings an older version back as a new version. */
export function useRestoreVersion(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiPost(
        `/projects/${encodeURIComponent(projectId ?? '')}/versions/${encodeURIComponent(versionId)}/restore`,
        {},
        projectDetailSchema,
      ),
    onSuccess: (project: ProjectDetail) => {
      queryClient.setQueryData(queryKeys.project(project.id), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.versions(project.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/** Ask for a change in plain language. Returns a proposal; nothing is applied. */
export function useProposeChange(projectId: string | undefined) {
  return useMutation({
    mutationFn: (prompt: string) =>
      apiPost(
        `/projects/${encodeURIComponent(projectId ?? '')}/change-request`,
        { prompt },
        changeProposalResponseSchema,
      ),
  });
}

/** Apply only the operations the user ticked, as a new version. */
export function useAcceptChange(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, operationIds }: { proposalId: string; operationIds: string[] }) =>
      apiPost(
        `/projects/${encodeURIComponent(projectId ?? '')}/change-request/${encodeURIComponent(proposalId)}/accept`,
        { operationIds },
        projectDetailSchema,
      ),
    onSuccess: (project: ProjectDetail) => {
      queryClient.setQueryData(queryKeys.project(project.id), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.versions(project.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/** Discard a proposal. The design is untouched. */
export function useRejectChange(projectId: string | undefined) {
  return useMutation({
    mutationFn: (proposalId: string) =>
      apiPost(
        `/projects/${encodeURIComponent(projectId ?? '')}/change-request/${encodeURIComponent(proposalId)}/reject`,
        {},
        z.unknown(),
      ),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requirements: Requirements) =>
      apiPost('/projects', createProjectRequestSchema.parse({ requirements }), projectDetailSchema),
    onSuccess: (project: ProjectDetail) => {
      // Seed the detail cache so the canvas page renders without a second fetch,
      // and mark the list stale so it shows the new project.
      queryClient.setQueryData(queryKeys.project(project.id), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
