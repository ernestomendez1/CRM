import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getTranslations } from 'next-intl/server';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { QuotationPDF } from '@/lib/pdf/QuotationPDF';
import type { Quotation, QuotationItem } from '@/lib/validation/quotation';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctxParams: RouteContext<'/api/pdf/quotation/[id]'>) {
  const { id } = await ctxParams.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('quotations');

  const [{ data: quotation, error: qErr }, { data: items, error: iErr }, { data: business }] =
    await Promise.all([
      supabase
        .from('quotations')
        .select('*, customers(name, company_name, tax_id, email, address, city, country)')
        .eq('id', id)
        .eq('business_id', ctx.businessId)
        .maybeSingle(),
      supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', id)
        .order('sort_order'),
      supabase
        .from('businesses')
        .select(
          'name, legal_name, tax_id, email, phone, address, city, country, logo_url, pdf_settings',
        )
        .eq('id', ctx.businessId)
        .maybeSingle(),
    ]);

  if (qErr) return new NextResponse(qErr.message, { status: 500 });
  if (iErr) return new NextResponse(iErr.message, { status: 500 });
  if (!quotation) return new NextResponse('Not found', { status: 404 });

  const q = quotation as unknown as Quotation & {
    customers: {
      name: string;
      company_name: string | null;
      tax_id: string | null;
      email: string | null;
      address: string | null;
      city: string | null;
      country: string | null;
    } | null;
  };
  const itemRows = (items ?? []) as unknown as QuotationItem[];

  if (!q.customers) return new NextResponse('Customer missing', { status: 500 });

  const buffer = await renderToBuffer(
    QuotationPDF({
      business: (business ?? { name: 'Business' }) as Parameters<typeof QuotationPDF>[0]['business'],
      customer: q.customers,
      quotation: {
        quotation_number: q.quotation_number,
        issue_date: q.issue_date,
        expiry_date: q.expiry_date,
        notes: q.notes,
        terms: q.terms,
        subtotal: Number(q.subtotal),
        discount_total: Number(q.discount_total),
        tax_total: Number(q.tax_total),
        total: Number(q.total),
        currency: q.currency,
      },
      items: itemRows.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct),
        tax_rate: Number(it.tax_rate),
        line_total: Number(it.line_total),
      })),
      labels: {
        documentTitle: t('title').toUpperCase(),
        issueDate: t('fields.issueDate'),
        expiryDate: t('fields.expiryDate'),
        billTo: t('fields.customer'),
        description: t('lineItems.description'),
        quantity: t('lineItems.quantity'),
        unitPrice: t('lineItems.unitPrice'),
        discount: t('lineItems.discount'),
        taxRate: t('lineItems.taxRate'),
        lineTotal: t('lineItems.lineTotal'),
        subtotal: t('lineItems.subtotal'),
        discountTotal: t('lineItems.discountTotal'),
        taxTotal: t('lineItems.taxTotal'),
        total: t('lineItems.total'),
        notes: t('fields.notes'),
        terms: t('fields.terms'),
        pageOf: (current: number, total: number) => `${current} / ${total}`,
      },
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${q.quotation_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
