import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import { ProfileForm } from './sections/profile-form';
import { TaxForm } from './sections/tax-form';
import { NumberingForm } from './sections/numbering-form';
import { PdfForm } from './sections/pdf-form';
import { LogoUploader } from './sections/logo-uploader';

type BusinessRow = {
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  default_currency: string;
  default_tax_rate: number;
  default_payment_terms_days: number;
  invoice_prefix: string;
  invoice_next_number: number;
  quotation_prefix: string;
  quotation_next_number: number;
  pdf_settings: {
    primary_color?: string;
    footer_text?: string;
    show_logo?: boolean;
  } | null;
};

export default async function SettingsPage() {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('settings');

  const { data, error } = await supabase
    .from('businesses')
    .select(
      'name, legal_name, tax_id, email, phone, address, city, country, logo_url, default_currency, default_tax_rate, default_payment_terms_days, invoice_prefix, invoice_next_number, quotation_prefix, quotation_next_number, pdf_settings',
    )
    .eq('id', ctx.businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const b = (data ?? {}) as Partial<BusinessRow>;

  const pdfDefaults = {
    primary_color: b.pdf_settings?.primary_color ?? '#1a1a1a',
    footer_text: b.pdf_settings?.footer_text ?? '',
    show_logo: b.pdf_settings?.show_logo ?? true,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="tax">{t('tabs.tax')}</TabsTrigger>
          <TabsTrigger value="numbering">{t('tabs.numbering')}</TabsTrigger>
          <TabsTrigger value="pdf">{t('tabs.pdf')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.title')}</CardTitle>
              <CardDescription>{t('profile.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LogoUploader logoUrl={b.logo_url ?? null} />
              <ProfileForm
                defaults={{
                  name: b.name ?? '',
                  legal_name: b.legal_name ?? '',
                  tax_id: b.tax_id ?? '',
                  email: b.email ?? '',
                  phone: b.phone ?? '',
                  address: b.address ?? '',
                  city: b.city ?? '',
                  country: b.country ?? 'DO',
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('tax.title')}</CardTitle>
              <CardDescription>{t('tax.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TaxForm
                defaults={{
                  default_currency: b.default_currency ?? 'DOP',
                  default_tax_rate: Number(b.default_tax_rate ?? 0.18),
                  default_payment_terms_days: Number(b.default_payment_terms_days ?? 30),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbering" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('numbering.title')}</CardTitle>
              <CardDescription>{t('numbering.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <NumberingForm
                defaults={{
                  invoice_prefix: b.invoice_prefix ?? 'INV-',
                  invoice_next_number: Number(b.invoice_next_number ?? 1),
                  quotation_prefix: b.quotation_prefix ?? 'QUO-',
                  quotation_next_number: Number(b.quotation_next_number ?? 1),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('pdf.title')}</CardTitle>
              <CardDescription>{t('pdf.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <PdfForm defaults={pdfDefaults} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
