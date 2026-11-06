import counterpart from "counterpart";

/** The words of the strategies page (`strategies.*` in the locale files). */
export const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`strategies.${key}`, params) as string;
