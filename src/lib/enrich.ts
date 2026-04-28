import type { EnrichedSchichtplan } from '@/types/enriched';
import type { Mitarbeiter, Schichtplan, Schichttypen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface SchichtplanMaps {
  schichttypenMap: Map<string, Schichttypen>;
  mitarbeiterMap: Map<string, Mitarbeiter>;
}

export function enrichSchichtplan(
  schichtplan: Schichtplan[],
  maps: SchichtplanMaps
): EnrichedSchichtplan[] {
  return schichtplan.map(r => ({
    ...r,
    schichttypName: resolveDisplay(r.fields.schichttyp, maps.schichttypenMap, 'schichtname'),
    mitarbeiterName: resolveDisplay(r.fields.mitarbeiter, maps.mitarbeiterMap, 'vorname', 'nachname'),
  }));
}
