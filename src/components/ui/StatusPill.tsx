import { useLanguage } from '../../lib/i18n';
import './StatusPill.css';
import type { PaymentStatus } from '../../lib/types';

const KEYS: Record<PaymentStatus, string> = {
  pending: 'status.pending',
  paid: 'status.paid',
  overdue: 'status.overdue',
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  const { t } = useLanguage();
  return <span className={`oc-pill oc-pill--${status}`}>{t(KEYS[status])}</span>;
}
