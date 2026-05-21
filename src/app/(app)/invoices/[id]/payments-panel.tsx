'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney } from '@/lib/money/format';
import { paymentMethods, type PaymentMethod } from '@/lib/validation/payment';
import { addPayment, deletePayment, type PaymentActionResult } from '../actions';

type Row = {
  id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
};

type Props = {
  invoiceId: string;
  currency: string;
  locale: string;
  canEdit: boolean;
  payments: Row[];
};

export function PaymentsPanel({ invoiceId, currency, locale, canEdit, payments }: Props) {
  const t = useTranslations('payments');
  const [open, setOpen] = useState(false);
  const [pendingDelete, startDelete] = useTransition();

  const [state, action, pending] = useActionState<PaymentActionResult | null, FormData>(
    addPayment,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(t('added'));
      setOpen(false);
    } else if (state && !state.ok && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, t]);

  const fmt = (n: number) => formatMoney(Number(n), { currency, locale });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  {t('addPayment')}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addPayment')}</DialogTitle>
              </DialogHeader>
              <form action={action} className="space-y-3">
                <input type="hidden" name="invoice_id" value={invoiceId} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="payment_date">{t('fields.date')}</Label>
                    <Input
                      id="payment_date"
                      name="payment_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">{t('fields.amount')}</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="method">{t('fields.method')}</Label>
                    <Select name="method" defaultValue="transfer" required>
                      <SelectTrigger id="method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t(`methods.${m}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="reference">{t('fields.reference')}</Label>
                    <Input id="reference" name="reference" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="notes">{t('fields.notes')}</Label>
                    <Textarea id="notes" name="notes" rows={2} />
                  </div>
                </div>
                {state && !state.ok && (
                  <p className="text-sm text-red-600">{state.error}</p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={pending}>
                    {pending ? '…' : t('addPayment')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.date')}</TableHead>
                <TableHead>{t('fields.method')}</TableHead>
                <TableHead>{t('fields.reference')}</TableHead>
                <TableHead className="text-right">{t('fields.amount')}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`methods.${p.method}`)}</Badge>
                  </TableCell>
                  <TableCell>{p.reference ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(Number(p.amount))}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pendingDelete}
                        onClick={() => {
                          if (!window.confirm(t('deleteConfirm'))) return;
                          startDelete(async () => {
                            try {
                              await deletePayment(invoiceId, p.id);
                              toast.success(t('removed'));
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Error');
                            }
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
