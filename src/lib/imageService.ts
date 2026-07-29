import { supabase } from './supabase';

const PRODUCT_BUCKET = 'product-images';

export async function createProductSignedUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60
) {
  const { data, error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

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

  return createProductSignedUrl(imagePathOrUrl);
}

function base64ToBlob(
  base64: string,
  contentType: string
) {
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], {
    type: contentType,
  });
}

export async function downloadRemoteImage(
  imageUrl: string,
  fileName: string
) {
  const { data, error } =
    await supabase.functions.invoke(
      'download-visual',
      {
        body: {
          image_url: imageUrl,
        },
      }
    );

  if (error) {
    let detail = error.message;

    try {
      const context = (error as any)?.context;

      if (context instanceof Response) {
        const text = await context.text();

        if (text) {
          try {
            const parsed = JSON.parse(text);

            detail =
              parsed?.error ||
              parsed?.message ||
              text;
          } catch {
            detail = text;
          }
        }
      }
    } catch (contextError) {
      console.error(
        'Unable to read download service error:',
        contextError
      );
    }

    throw new Error(
      `Download service failed: ${detail}`
    );
  }

  if (data?.error) {
    throw new Error(
      `Download service failed: ${String(data.error)}`
    );
  }

  if (!data?.base64) {
    throw new Error(
      'Download service returned no image.'
    );
  }

  const contentType =
    data.contentType || 'image/jpeg';

  const blob = base64ToBlob(
    data.base64,
    contentType
  );

  const extension =
    contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : 'jpg';

  const finalName =
    /\.(png|jpg|jpeg|webp)$/i.test(fileName)
      ? fileName
      : `${fileName}.${extension}`;

  const blobUrl =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = blobUrl;
  anchor.download = finalName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 1000);
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

const AI_OUTPUT_BUCKET = 'ai-outputs';

/**
 * Backward compatible:
 *
 * Old outputs:
 * https://api.together.ai/...
 *
 * New outputs:
 * project-id/generation-id/visual-1.jpg
 */
export async function resolveAIOutputUrl(
  imagePathOrUrl: string | null | undefined,
  expiresInSeconds = 60 * 60
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

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(AI_OUTPUT_BUCKET)
      .createSignedUrl(
        imagePathOrUrl,
        expiresInSeconds
      );

  if (error) {
    throw new Error(
      `AI output URL failed: ${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      'Supabase did not return an AI output URL.'
    );
  }

  return data.signedUrl;
}
