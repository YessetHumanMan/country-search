/** Внутренняя модель карточки и деталей, независимая от схемы API. */
export interface Country {
  name: string;
  flag: string;
  flagUrl: string;
  capital: string;
  region: string;
  population: number | null;
  languages: string[];
  currencies: string[];
  area: number | null;
  borders: string[];
  description: string;
}

/** Поля countries.dev, используемые приложением; необязательные могут отсутствовать. */
export interface RawCountry {
  name: string;
  flag?: string;
  flags?: {
    png?: string;
    svg?: string;
  };
  capital?: string;
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  borders?: string[];
  languages?: { name: string; nativeName?: string }[];
  currencies?: { code?: string; name: string; symbol?: string }[];
}
