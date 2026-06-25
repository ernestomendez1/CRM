'use server';

import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth/session';
import {
  numberingSchema,
  pdfSettingsSchema,
  profileSchema,
  taxSettingsSchema,
} from '@crm/contracts/settings';
import * as api from '@/lib/api/settings';

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function flatten(parsed: {
  success: false;
  error: { flatten: () => { fieldErrors: Record<string, string[]> } };
}): SettingsResult {
  return {
    ok: false,
    error: 'Validation failed',
    fieldErrors: parsed.error.flatten().fieldErrors,
  };
}

function revalidateSettings(layout = false) {
  revalidatePath('/settings');
  if (layout) revalidatePath('/', 'layout');
}

export async function updateProfile(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  await requireBusiness();
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

  const res = await api.updateProfile(parsed.data);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings(true);
  return { ok: true };
}

export async function updateTaxSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  await requireBusiness();
  const parsed = taxSettingsSchema.safeParse({
    default_currency: formData.get('default_currency'),
    default_tax_rate: formData.get('default_tax_rate'),
    default_payment_terms_days: formData.get('default_payment_terms_days'),
  });
  if (!parsed.success) return flatten(parsed);

  const res = await api.updateTaxSettings(parsed.data);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings();
  return { ok: true };
}

export async function updateNumbering(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  await requireBusiness();
  const parsed = numberingSchema.safeParse({
    invoice_prefix: formData.get('invoice_prefix'),
    invoice_next_number: formData.get('invoice_next_number'),
    quotation_prefix: formData.get('quotation_prefix'),
    quotation_next_number: formData.get('quotation_next_number'),
  });
  if (!parsed.success) return flatten(parsed);

  const res = await api.updateNumbering(parsed.data);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings();
  return { ok: true };
}

export async function updatePdfSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  await requireBusiness();
  const parsed = pdfSettingsSchema.safeParse({
    primary_color: formData.get('primary_color') || '#1a1a1a',
    footer_text: formData.get('footer_text'),
    show_logo: formData.get('show_logo') === 'on',
  });
  if (!parsed.success) return flatten(parsed);

  const res = await api.updatePdfSettings(parsed.data);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings();
  return { ok: true };
}

export async function uploadLogo(formData: FormData): Promise<SettingsResult> {
  await requireBusiness();
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'No file selected.' };
  }

  const res = await api.uploadLogo(file);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings(true);
  return { ok: true };
}

export async function removeLogo(): Promise<SettingsResult> {
  await requireBusiness();
  const res = await api.removeLogo();
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidateSettings(true);
  return { ok: true };
}
