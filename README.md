# Casani AI Studio MVP

Premium React/Vite MVP intended for Lovable/GitHub + Supabase.

## Run locally
1. `npm install`
2. `npm run dev`

The UI works immediately in demo mode using localStorage and sample result images.

## Supabase
1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Copy `.env.example` to `.env` and add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
4. Connect Lovable to the same Supabase project.

## Real AI generation
The included Edge Function is `supabase/functions/generate-visual/index.ts`.
Set server secret `FAL_KEY`. Never put FAL_KEY in VITE_* or browser code.

Current function demonstrates a call to `fal-ai/gpt-image-1.5/edit` with the uploaded product as an image reference. For production, implement queue polling/webhooks and upload the phone photo to public/signed storage first rather than sending base64.

## Lovable
Fastest path: create/import this repository through GitHub, then ask Lovable:
"Keep the existing Casani visual design. Connect all CRUD to Supabase, replace localStorage with Supabase tables, upload product images to product-images Storage, add Supabase email/password auth, and wire Generate to the generate-visual Edge Function. Keep API secrets server-side."
