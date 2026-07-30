import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  Plus,
  Trash2,
} from 'lucide-react';

import {
  deleteProduct,
  getProductsFromSupabase,
} from '../lib/productService';

import {
  resolveProductImageUrl,
} from '../lib/imageService';

type ProductItem = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  image_url: string | null;
  created_at: string;
  displayUrl: string;
};

export default function Products() {
  const [
    items,
    setItems,
  ] = useState<ProductItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);

  const [
    errorMsg,
    setErrorMsg,
  ] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setErrorMsg('');

        const rows =
          await getProductsFromSupabase();

        const mapped =
          await Promise.all(
            rows.map(
              async (product: any) => {
                let displayUrl = '';

                if (product.image_url) {
                  try {
                    displayUrl =
                      await resolveProductImageUrl(
                        product.image_url
                      );
                  } catch (error) {
                    console.warn(
                      'Product image load failed:',
                      product.id,
                      error
                    );
                  }
                }

                return {
                  ...product,
                  displayUrl,
                } as ProductItem;
              }
            )
          );

        setItems(mapped);
      } catch (error) {
        console.error(
          'Products load failed:',
          error
        );

        setErrorMsg(
          error instanceof Error
            ? error.message
            : 'Unable to load products.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function removeProduct(
    product: ProductItem
  ) {
    if (deletingId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${product.name}"?\n\nIf this product is already used by a project, Casani will keep it and show an error instead of deleting project history.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(product.id);
    setErrorMsg('');

    try {
      await deleteProduct(
        product.id,
        product.image_url
      );

      setItems(
        (current) =>
          current.filter(
            (item) =>
              item.id !== product.id
          )
      );
    } catch (error) {
      console.error(
        'Product delete failed:',
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Unable to delete product.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="sectionHead">
        <div>
          <p className="eyebrow">
            LIBRARY
          </p>

          <h1>
            Sản phẩm
          </h1>
        </div>

        <Link
          className="btn primary"
          to="/create"
        >
          <Plus size={17} />
          Add product
        </Link>
      </div>

      {errorMsg && (
        <div className="empty">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty">
          Loading products...
        </div>
      ) : items.length ? (
        <div className="grid productGrid">
          {items.map(
            (product) => (
              <article
                className="productCard"
                key={product.id}
              >
                {product.displayUrl ? (
                  <img
                    src={product.displayUrl}
                    alt={product.name}
                  />
                ) : (
                  <div className="projectPlaceholder">
                    No product image
                  </div>
                )}

                <div>
                  <span>
                    {product.sku || 'No SKU'}
                  </span>

                  <b>
                    {product.name}
                  </b>

                  <small>
                    {product.category ||
                      'Ánh sáng'}
                  </small>
                </div>

                <button
                  className="trash"
                  type="button"
                  onClick={() =>
                    removeProduct(product)
                  }
                  disabled={
                    deletingId ===
                    product.id
                  }
                  title="Delete product"
                >
                  <Trash2 size={16} />
                </button>
              </article>
            )
          )}
        </div>
      ) : (
        <div className="empty">
          Your product library is empty.
        </div>
      )}
    </>
  );
}
