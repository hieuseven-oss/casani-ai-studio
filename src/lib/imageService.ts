import { supabase } from './supabase';

const PRODUCT_BUCKET = 'product-images';

/**
 * Tạo URL tạm thời để trình duyệt hoặc AI provider
 * truy cập ảnh sản phẩm trong private Storage.
 */
export async function createProductSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60
) {
  const { data, error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .createSignedUrl(
      storagePath,
      expiresInSeconds
    );

  if (error) {
    throw new Error(
      `Product image URL failed: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      'Supabase did not return a product image URL.'
    );
  }

  return data.signedUrl;
}

/**
 * Trường hợp dữ liệu đã là URL http/https thì giữ nguyên.
 * Nếu là Storage path thì tạo signed URL mới.
 */
export async function resolveProductImageUrl(
  imagePathOrUrl: string | null | undefined
) {
  if (!imagePathOrUrl) {
    return '';
  }

  if (
    imagePathOrUrl.startsWith('https://') ||
    imagePathOrUrl.startsWith('http://')
  ) {
    return imagePathOrUrl;
  }

  return createProductSignedUrl(
    imagePathOrUrl
  );
}

/**
 * Download URL bên ngoài về máy người dùng.
 */
export async function downloadRemoteImage(
  imageUrl: string,
  fileName: string
) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      `Download failed with status ${response.status}`
    );
  }

  const blob = await response.blob();

  let finalName = fileName;

  if (!/\.(png|jpg|jpeg|webp)$/i.test(finalName)) {
    const extension =
      blob.type.includes('png')
        ? 'png'
        : blob.type.includes('webp')
        ? 'webp'
        : 'jpg';

    finalName += `.${extension}`;
  }

  const blobUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = blobUrl;
  anchor.download = finalName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(blobUrl);
}

export function makeSafeFileName(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
