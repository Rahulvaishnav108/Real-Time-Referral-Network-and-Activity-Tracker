import { ArrowDownLeft, ArrowUpRight, Check, Clock3, MessageCircle, X } from 'lucide-react';
import type { ActivityEvent } from '../types';
import StatusBadge from './StatusBadge';

const ago = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function ActivityFeed({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  return <aside className="activity-panel">
    <div className="panel-heading"><div><p className="eyebrow">THE PULSE</p><h2>Recent activity</h2></div><span className="live-tag"><span />LIVE</span></div>
    <p className="panel-caption">Updates from your organization</p>
    <div className="activity-list">
      {loading && <div className="feed-empty">Loading activity…</div>}
      {!loading && events.length === 0 && <div className="feed-empty"><div className="empty-icon">✳</div><strong>A little quiet here</strong><span>Team updates will show up as they happen.</span></div>}
      {events.map((event, index) => {
        const created = event.action === 'created';
        const Icon = created ? ArrowUpRight : event.status === 'accepted' ? Check : event.status === 'rejected' ? X : event.status === 'contacted' ? MessageCircle : Clock3;
        return <article key={event.id} className={`activity-item ${index === 0 ? 'activity-fresh' : ''}`}>
          <div className={`activity-icon ${created ? 'activity-icon-create' : ''}`}><Icon size={15} /></div>
          <div className="activity-copy"><div className="activity-actor">{event.actorName} <span>{created ? 'made a referral' : 'updated status'}</span></div><div className="activity-candidate">{event.candidateEmail}</div>
            {created ? <span className="event-detail event-note">Referral added to the network</span> : <span className="event-detail">{event.previousStatus && <><span className="old-status">{event.previousStatus}</span><ArrowDownLeft size={11} /></>}<StatusBadge status={event.status} /></span>}
            <time>{ago(event.createdAt)}</time>
          </div>
        </article>;
      })}
    </div>
    <div className="feed-footer"><span className="tiny-live-dot" /> Connected to your team <span className="feed-secure">· Private workspace</span></div>
  </aside>;
}
