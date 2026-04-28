// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Mitarbeiter {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    nachname?: string;
    vorname?: string;
    personalnummer?: string;
    email?: string;
    telefon?: string;
  };
}

export interface Schichttypen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    schichtname?: string;
    startzeit?: string;
    endzeit?: string;
    beschreibung?: string;
  };
}

export interface Schichtplan {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    schichttyp?: string; // applookup -> URL zu 'Schichttypen' Record
    mitarbeiter?: string; // applookup -> URL zu 'Mitarbeiter' Record
    notizen?: string;
  };
}

export const APP_IDS = {
  MITARBEITER: '69f08caf792cede476cc499b',
  SCHICHTTYPEN: '69f08cb4370392003b52884a',
  SCHICHTPLAN: '69f08cb5005265215129c479',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'mitarbeiter': {
    'nachname': 'string/text',
    'vorname': 'string/text',
    'personalnummer': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
  },
  'schichttypen': {
    'schichtname': 'string/text',
    'startzeit': 'string/text',
    'endzeit': 'string/text',
    'beschreibung': 'string/textarea',
  },
  'schichtplan': {
    'datum': 'date/date',
    'schichttyp': 'applookup/select',
    'mitarbeiter': 'applookup/select',
    'notizen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitarbeiter = StripLookup<Mitarbeiter['fields']>;
export type CreateSchichttypen = StripLookup<Schichttypen['fields']>;
export type CreateSchichtplan = StripLookup<Schichtplan['fields']>;