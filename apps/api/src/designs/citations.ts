import type { CorpusSearchResult } from '@trestle/shared';

/**
 * Turns the slugs a model cited into real library ids, dropping anything that
 * was not supplied to it. This is the anti-hallucination check for sources: a
 * model that invents a plausible-looking slug gets no citation at all.
 *
 * Deliberately free of database, config and logger imports so it can be unit
 * tested without any environment.
 */
export function resolveCitations<T extends { sources: string[] }>(
  components: T[],
  entries: Pick<CorpusSearchResult, 'id' | 'slug'>[],
): { components: T[]; invented: string[] } {
  const idBySlug = new Map(entries.map((entry) => [entry.slug, entry.id]));
  const invented: string[] = [];

  const resolved = components.map((component) => {
    const sources: string[] = [];
    for (const slug of component.sources) {
      const id = idBySlug.get(slug);
      if (id) sources.push(id);
      else invented.push(slug);
    }
    return { ...component, sources: [...new Set(sources)] };
  });

  return { components: resolved, invented };
}

/**
 * Removes citation slugs the model pasted into its prose, e.g.
 * "...frees an early team from building auth [auth-use-managed-identity-provider]."
 *
 * Sources belong in the sources list and are shown as links in the panel; inside
 * a sentence they are noise. The prompt also forbids this, but models do it
 * anyway, so the text is cleaned before it is ever stored.
 */
export function stripInlineCitations(text: string): string {
  return (
    text
      // [slug], (slug), [slug, other-slug]
      .replace(
        /[([]\s*[a-z0-9]+(?:-[a-z0-9]+){1,}(?:\s*,\s*[a-z0-9]+(?:-[a-z0-9]+){1,})*\s*[)\]]/g,
        '',
      )
      // "(source: ...)" / "(see ...)" style leftovers
      .replace(/\((?:source|sources|see|ref|cf)\s*:?[^)]*\)/gi, '')
      // tidy the spacing the removals leave behind
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .trim()
  );
}
