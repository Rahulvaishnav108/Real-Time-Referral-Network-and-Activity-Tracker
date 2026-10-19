import { Check, Clock3, MessageCircle, X } from 'lucide-react';
import type { ReferralStatus } from '../types';

const config: Record<ReferralStatus, { label: string; icon: typeof Clock3; className: string }> = {
  pending: { label: 'Pending', icon: Clock3, className: 'status-pending' },
  contacted: { label: 'Contacted', icon: MessageCircle, className: 'status-contacted' },
  accepted: { label: 'Accepted', icon: Check, className: 'status-accepted' },
  rejected: { label: 'Rejected', icon: X, className: 'status-rejected' }
};

export default function StatusBadge({ status }: { status: ReferralStatus }) {
  const item = config[status]; const Icon = item.icon;
  return <span className={`status-badge ${item.className}`}><Icon size={12} strokeWidth={2.2} />{item.label}</span>;
}
