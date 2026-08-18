import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { StatusPill } from '../../components/ui/StatusPill';
import { STUDENT_NAV } from './nav';
import type { Payment } from '../../lib/types';

const RECEIPTS_BUCKET = 'payment-receipts';

export function StudentPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', profile.id)
      .order('period_start', { ascending: false });
    const rows = data ?? [];
    setPayments(rows);

    const urls: Record<number, string> = {};
    await Promise.all(
      rows
        .filter((p) => p.receipt_path)
        .map(async (p) => {
          const { data: signed } = await supabase.storage
            .from(RECEIPTS_BUCKET)
            .createSignedUrl(p.receipt_path as string, 60 * 60);
          if (signed?.signedUrl) urls[p.id] = signed.signedUrl;
        }),
    );
    setReceiptUrls(urls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleUpload(paymentId: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    setError(null);
    setUploadingId(paymentId);

    const path = `${profile.id}/${paymentId}-${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file);
    if (uploadErr) {
      setError(uploadErr.message);
      setUploadingId(null);
      return;
    }

    const { error: updateErr } = await supabase.from('payments').update({ receipt_path: path }).eq('id', paymentId);
    if (updateErr) setError(updateErr.message);

    setUploadingId(null);
    load();
  }

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Mis pagos</h1>

      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : payments.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no hay pagos registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)', marginTop: 'var(--oc-space-4)' }}>
          {payments.map((payment) => (
            <Card key={payment.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
                <span>
                  {payment.period_start} → {payment.period_end} · {payment.amount} {payment.currency}
                </span>
                <StatusPill status={payment.status} />
              </div>

              <div style={{ marginTop: 'var(--oc-space-2)', fontSize: 13 }}>
                {receiptUrls[payment.id] ? (
                  <a href={receiptUrls[payment.id]} target="_blank" rel="noreferrer">
                    Ver comprobante subido
                  </a>
                ) : payment.status === 'pending' ? (
                  <label style={{ color: 'var(--oc-energy)', cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      disabled={uploadingId === payment.id}
                      onChange={(e) => handleUpload(payment.id, e)}
                    />
                    {uploadingId === payment.id ? 'Subiendo…' : '+ Subir comprobante'}
                  </label>
                ) : (
                  <span style={{ color: 'var(--oc-text-muted)' }}>Sin comprobante</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
