import './StatusPill.css';
import type { PaymentStatus } from '../../lib/types';

const LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  overdue: 'Vencido',
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  return <span className={`oc-pill oc-pill--${status}`}>{LABELS[status]}</span>;
}
