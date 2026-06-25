import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getTranslations } from 'next-intl/server';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { InvoicePDF } from '@/lib/pdf/InvoicePDF';
import type { Invoice, InvoiceItem } from '@crm/contracts/invoice';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctxParams: RouteContext<'/api/pdf/invoice/[id]'>) {
  const { id } = await ctxParams.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('invoices');
  const tq = await getTranslations('quotations');

  const [{ data: invoice, error: invErr }, { data: items, error: iErr }, { data: business }] =
    await Promise.all([
      supabase
        .from('invoices')
        .select('*, customers(name, company_name, tax_id, email, address, city, country)')
        .eq('id', id)
        .eq('business_id', ctx.businessId)
        .maybeSingle(),
      supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order'),
      supabase
        .from('businesses')
        .select(
          'name, legal_name, tax_id, email, phone, address, city, country, logo_url, pdf_settings',
        )
        .eq('id', ctx.businessId)
        .maybeSingle(),
    ]);

  if (invErr) return new NextResponse(invErr.message, { status: 500 });
  if (iErr) return new NextResponse(iErr.message, { status: 500 });
  if (!invoice) return new NextResponse('Not found', { status: 404 });

  const inv = invoice as unknown as Invoice & {
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
  const itemRows = (items ?? []) as unknown as InvoiceItem[];

  if (!inv.customers) return new NextResponse('Customer missing', { status: 500 });

  const buffer = await renderToBuffer(
    InvoicePDF({
      business: (business ?? { name: 'Business' }) as Parameters<typeof InvoicePDF>[0]['business'],
      customer: inv.customers,
      invoice: {
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
        notes: inv.notes,
        terms: inv.terms,
        subtotal: Number(inv.subtotal),
        discount_total: Number(inv.discount_total),
        tax_total: Number(inv.tax_total),
        total: Number(inv.total),
        amount_paid: Number(inv.amount_paid),
        balance_due: Number(inv.balance_due),
        currency: inv.currency,
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
        dueDate: t('fields.dueDate'),
        billTo: t('fields.customer'),
        description: tq('lineItems.description'),
        quantity: tq('lineItems.quantity'),
        unitPrice: tq('lineItems.unitPrice'),
        discount: tq('lineItems.discount'),
        taxRate: tq('lineItems.taxRate'),
        lineTotal: tq('lineItems.lineTotal'),
        subtotal: tq('lineItems.subtotal'),
        discountTotal: tq('lineItems.discountTotal'),
        taxTotal: tq('lineItems.taxTotal'),
        total: tq('lineItems.total'),
        amountPaid: t('fields.amountPaid'),
        balanceDue: t('fields.balanceDue'),
        statusLabel: t('fields.status'),
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
      'Content-Disposition': `inline; filename="${inv.invoice_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
