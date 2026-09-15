import { useSearchParams } from 'react-router';

/**
 * Builds the path to an episode page. In dev, the `?fake=1` scrubber flag is
 * carried across episode links so a scrub-through session survives navigation;
 * production links are always the bare `/ep/:id` (contracts/routes.md).
 */
export function useEpisodePath(): (id: number) => string {
  const [searchParams] = useSearchParams();
  const fake = import.meta.env.DEV && searchParams.get('fake') === '1';
  return (id: number) => (fake ? `/ep/${id}?fake=1` : `/ep/${id}`);
}

export default useEpisodePath;
