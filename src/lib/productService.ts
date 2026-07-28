import { supabase } from './supabase';

type CreateProductInput = {
  sku: string;
  name: string;
  file: File;
};

export async function createProductWithImage({
  sku,
  name,
  file,
}: CreateProductInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User is not authenticated');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeSku = (sku || 'product')
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '-');

  const filePath = `${user.id}/${Date.now()}-${safeSku}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from('product-images')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);

  if (signedError) {
    throw new Error(`Image URL failed: ${signedError.message}`);
  }

  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      sku: sku.trim() || null,
      name: name.trim(),
      category: 'Lighting',
      image_url: filePath,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Product save failed: ${insertError.message}`);
  }

  return {
    product,
    previewUrl: signed.signedUrl,
    storagePath: filePath,
  };
}
