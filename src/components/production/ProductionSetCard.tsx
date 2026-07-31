import {
  Check,
  Download,
  ExternalLink,
} from 'lucide-react';

import type {
  ProductionSet,
} from '../../lib/productionService';

type ProductionSetCardProps = {
  set: ProductionSet;

  onOpenStudio: (
    set: ProductionSet
  ) => void;

  onDownloadSet: (
    set: ProductionSet
  ) => void;

  downloading?: boolean;
};

function roleLabel(
  role: string | null
) {
  switch (role) {
    case 'left_three_quarter':
      return '3/4 trái';

    case 'right_three_quarter':
      return '3/4 phải';

    case 'hero_close':
      return 'Cận cảnh đèn';

    default:
      return 'Asset';
  }
}

export default function ProductionSetCard({
  set,
  onOpenStudio,
  onDownloadSet,
  downloading = false,
}: ProductionSetCardProps) {
  return (
    <article className="productionSetCard">
      <div className="productionSetPreview">
        {set.assets.map(
          (asset) => (
            <figure
              key={asset.id}
              className="productionAssetPreview"
            >
              <img
                src={asset.imageUrl}
                alt={roleLabel(
                  asset.role
                )}
              />

              <figcaption>
                {roleLabel(
                  asset.role
                )}
              </figcaption>
            </figure>
          )
        )}
      </div>

      <div className="productionSetBody">
        <div className="productionSetTitleRow">
          <div>
            <span className="productionSetEyebrow">
              PRODUCTION SET
            </span>

            <h2>
              {set.productName}
            </h2>

            {set.productSku && (
              <div className="productionSetSku">
                SKU: {set.productSku}
              </div>
            )}
          </div>

          <span className="productionReadyBadge">
            <Check size={14} />
            Production Ready
          </span>
        </div>

        <div className="productionSetMeta">
          {set.style && (
            <span>
              {set.style}
            </span>
          )}

          {set.space && (
            <span>
              {set.space}
            </span>
          )}

          {set.mood && (
            <span>
              {set.mood}
            </span>
          )}
        </div>

        <div className="productionSetActions">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              onOpenStudio(set)
            }
          >
            <ExternalLink size={16} />
            Mở Studio
          </button>

          <button
            type="button"
            className="btn"
            onClick={() =>
              onDownloadSet(set)
            }
            disabled={
              downloading
            }
          >
            <Download size={16} />
            {downloading
              ? 'Đang tải...'
              : 'Tải bộ ảnh'}
          </button>
        </div>
      </div>
    </article>
  );
}
