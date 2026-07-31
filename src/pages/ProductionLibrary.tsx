import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Download,
  Loader2,
  PackageCheck,
} from 'lucide-react';

import {
  getProductionSets,
  type ProductionSet,
} from '../lib/productionService';

import {
  downloadRemoteImage,
  makeSafeFileName,
} from '../lib/imageService';

import ProductionSetCard from '../components/production/ProductionSetCard';

function roleFileName(
  role: string | null,
  approved: boolean,
  fallbackIndex: number
) {
  if (approved) {
    return 'main';
  }

  switch (role) {
    case 'left_three_quarter':
      return 'left-3q';

    case 'right_three_quarter':
      return 'right-3q';

    case 'hero_close':
      return 'hero-close';

    default:
      return `asset-${fallbackIndex}`;
  }
}

export default function ProductionLibrary() {
  const navigate =
    useNavigate();

  const [sets, setSets] =
    useState<ProductionSet[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [downloadingGenerationId, setDownloadingGenerationId] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg('');

      try {
        const data =
          await getProductionSets();

        setSets(data);
      } catch (error) {
        console.error(error);

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to load Production Library.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function openStudio(
    set: ProductionSet
  ) {
    navigate(
      `/results/${set.projectId}`
    );
  }

  async function downloadSet(
    set: ProductionSet
  ) {
    if (downloadingGenerationId) {
      return;
    }

    setDownloadingGenerationId(
      set.generationId
    );

    setErrorMsg('');

    try {
      const safeName =
        makeSafeFileName(
          set.productName
        ) || 'casani';

      for (
        let index = 0;
        index < set.assets.length;
        index += 1
      ) {
        const asset =
          set.assets[index];

        const fileName =
          `${safeName}` +
          `-production` +
          `-${roleFileName(
            asset.role,
            asset.approved,
            index + 1
          )}`;

        await downloadRemoteImage(
          asset.imageUrl,
          fileName
        );
      }
    } catch (error) {
      console.error(error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to download Production Set.'
      );
    } finally {
      setDownloadingGenerationId(
        null
      );
    }
  }

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">
            PRODUCTION LIBRARY
          </p>

          <h1>
            Bộ ảnh đã sẵn sàng sản xuất
          </h1>

          <p>
            Quản lý các ảnh thành phẩm đã chọn
            và Camera Set bổ sung khi có.
            Đây là nguồn chính thức cho catalogue,
            website, quảng cáo và nội dung social.
          </p>
        </div>

        <div className="productionLibrarySummary">
          <PackageCheck size={20} />

          <div>
            <b>
              {sets.length}
            </b>

            <span>
              Production Sets
            </span>
          </div>
        </div>
      </header>

      {errorMsg && (
        <div
          className="empty"
          style={{
            marginBottom: 20,
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty">
          <Loader2 size={20} />
          Đang tải Production Library...
        </div>
      ) : sets.length > 0 ? (
        <div className="productionLibraryGrid">
          {sets.map(
            (set) => (
              <ProductionSetCard
                key={
                  set.generationId
                }
                set={set}
                onOpenStudio={
                  openStudio
                }
                onDownloadSet={
                  downloadSet
                }
                downloading={
                  downloadingGenerationId ===
                  set.generationId
                }
              />
            )
          )}
        </div>
      ) : (
        <div className="empty">
          <PackageCheck
            size={28}
          />

          <div
            style={{
              marginTop: 10,
            }}
          >
            Chưa có Production Set.
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 13,
            }}
          >
            Hãy chọn một ảnh thành phẩm
            trong Results Studio.
          </div>
        </div>
      )}

      {downloadingGenerationId && (
        <div className="productionDownloadNotice">
          <Download size={16} />
          Đang tải bộ ảnh...
        </div>
      )}
    </>
  );
}
