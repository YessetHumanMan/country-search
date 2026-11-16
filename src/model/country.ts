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
