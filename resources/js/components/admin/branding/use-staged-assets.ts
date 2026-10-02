import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrandAssetName } from './branding';

/** An image chosen but not sent yet, or the removal of the stored one. */
export type StagedAsset =
    | { type: 'file'; file: File; url: string }
    | { type: 'removal' };

export type StagedAssets = Partial<Record<BrandAssetName, StagedAsset>>;

function revoke(staged: StagedAsset | undefined): void {
    if (staged?.type === 'file') {
        URL.revokeObjectURL(staged.url);
    }
}

/**
 * Images wait here until Save. A staged file is shown from an object URL,
 * revoked as soon as the file is replaced, dropped, saved or the page left.
 */
export function useStagedAssets(): {
    staged: StagedAssets;
    count: number;
    stageFile: (asset: BrandAssetName, file: File) => void;
    stageRemoval: (asset: BrandAssetName) => void;
    drop: (asset: BrandAssetName) => void;
    clear: () => void;
} {
    const [staged, setStaged] = useState<StagedAssets>({});
    const latest = useRef(staged);

    const replace = useCallback(
        (asset: BrandAssetName, next: StagedAsset | undefined): void => {
            revoke(latest.current[asset]);

            const rest = { ...latest.current };

            delete rest[asset];

            latest.current =
                next === undefined ? rest : { ...rest, [asset]: next };
            setStaged(latest.current);
        },
        [],
    );

    const stageFile = useCallback(
        (asset: BrandAssetName, file: File): void =>
            replace(asset, {
                type: 'file',
                file,
                url: URL.createObjectURL(file),
            }),
        [replace],
    );

    const stageRemoval = useCallback(
        (asset: BrandAssetName): void => replace(asset, { type: 'removal' }),
        [replace],
    );

    const drop = useCallback(
        (asset: BrandAssetName): void => replace(asset, undefined),
        [replace],
    );

    const clear = useCallback((): void => {
        Object.values(latest.current).forEach(revoke);
        latest.current = {};
        setStaged({});
    }, []);

    useEffect(
        () => () => {
            Object.values(latest.current).forEach(revoke);
        },
        [],
    );

    return {
        staged,
        count: Object.keys(staged).length,
        stageFile,
        stageRemoval,
        drop,
        clear,
    };
}
