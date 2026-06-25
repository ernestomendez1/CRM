'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  numberingSchema,
  pdfSettingsSchema,
  profileSchema,
  taxSettingsSchema,
} from '@/lib/validation/settings';

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function flatten<T extends Record<string, unknown>>(
  parsed: { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } },
): SettingsResult {
  return {
    ok: false,
    error: 'Validation failed',
    fieldErrors: parsed.error.flatten().fieldErrors,
  };
}

export async function updateProfile(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    legal_name: formData.get('legal_name'),
    tax_id: formData.get('tax_id'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    country: formData.get('country'),
  });
  if (!parsed.success) return flatten(parsed);

  const supabase = await createClient();
  const { error } = await supabase
    .from('businesses')
    .update(parsed.data)
    .eq('id', ctx.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateTaxSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const parsed = taxSettingsSchema.safeParse({
    default_currency: formData.get('default_currency'),
    default_tax_rate: formData.get('default_tax_rate'),
    default_payment_terms_days: formData.get('default_payment_terms_days'),
  });
  if (!parsed.success) return flatten(parsed);

  const supabase = await createClient();
  const { error } = await supabase
    .from('businesses')
    .update(parsed.data)
    .eq('id', ctx.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}

export async function updateNumbering(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const parsed = numberingSchema.safeParse({
    invoice_prefix: formData.get('invoice_prefix'),
    invoice_next_number: formData.get('invoice_next_number'),
    quotation_prefix: formData.get('quotation_prefix'),
    quotation_next_number: formData.get('quotation_next_number'),
  });
  if (!parsed.success) return flatten(parsed);

  const supabase = await createClient();

  const { data: current, error: cErr } = await supabase
    .from('businesses')
    .select('invoice_next_number, quotation_next_number')
    .eq('id', ctx.businessId)
    .maybeSingle();
  if (cErr) return { ok: false, error: cErr.message };
  const c = current as { invoice_next_number: number; quotation_next_number: number } | null;
  if (c) {
    if (parsed.data.invoice_next_number < c.invoice_next_number) {
      return {
        ok: false,
        error: 'Invoice counter cannot move backwards.',
        fieldErrors: { invoice_next_number: ['Must be ≥ current value'] },
      };
    }
    if (parsed.data.quotation_next_number < c.quotation_next_number) {
      return {
        ok: false,
        error: 'Quotation counter cannot move backwards.',
        fieldErrors: { quotation_next_number: ['Must be ≥ current value'] },
      };
    }
  }

  const { error } = await supabase
    .from('businesses')
    .update(parsed.data)
    .eq('id', ctx.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}

export async function updatePdfSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const parsed = pdfSettingsSchema.safeParse({
    primary_color: formData.get('primary_color') || '#1a1a1a',
    footer_text: formData.get('footer_text'),
    show_logo: formData.get('show_logo') === 'on',
  });
  if (!parsed.success) return flatten(parsed);

  const supabase = await createClient();
  const { error } = await supabase
    .from('businesses')
    .update({ pdf_settings: parsed.data })
    .eq('id', ctx.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}

const LOGO_BUCKET = 'logos';
const ALLOWED_LOGO_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);
const MAX_LOGO_BYTES = 1_048_576;

export async function uploadLogo(formData: FormData): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file selected.' };
  }
  if (!ALLOWED_LOGO_MIMES.has(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}` };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'File exceeds 1 MB.' };
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const path = `${ctx.businessId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createServiceClient();
  const { error: upErr } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: pub } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const logoUrl = pub.publicUrl;

  // Best-effort: delete the previous logo from storage.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('businesses')
    .select('logo_url')
    .eq('id', ctx.businessId)
    .maybeSingle();
  const prev = (existing as { logo_url: string | null } | null)?.logo_url;
  if (prev) {
    const prevPath = extractStoragePath(prev, LOGO_BUCKET);
    if (prevPath) await admin.storage.from(LOGO_BUCKET).remove([prevPath]);
  }

  const { error: updErr } = await supabase
    .from('businesses')
    .update({ logo_url: logoUrl })
    .eq('id', ctx.businessId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/settings');
  return { ok: true };
}

export async function removeLogo(): Promise<SettingsResult> {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const admin = createServiceClient();

  const { data, error: lookupErr } = await supabase
    .from('businesses')
    .select('logo_url')
    .eq('id', ctx.businessId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };

  const current = (data as { logo_url: string | null } | null)?.logo_url;
  if (current) {
    const path = extractStoragePath(current, LOGO_BUCKET);
    if (path) await admin.storage.from(LOGO_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from('businesses')
    .update({ logo_url: null })
    .eq('id', ctx.businessId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  return { ok: true };
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  // Public URLs look like: .../storage/v1/object/public/<bucket>/<path>
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
