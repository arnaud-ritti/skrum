export type BrandIdentity = {
    name: string;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
};

export type Brand = BrandIdentity & {
    faviconUrl: string | null;
    poweredBy: boolean;
};
