export type Role = 'user' | 'admin';
export type ReferralStatus = 'pending' | 'contacted' | 'accepted' | 'rejected';

export interface SessionUser { id: string; organizationId: string; role: Role; name: string; email: string }
export interface Referral {
  id: string; candidateEmail: string; note: string; status: ReferralStatus;
  createdAt: string; statusUpdatedAt: string;
  createdBy: { id: string; name: string; email: string } | string;
}
export interface ActivityEvent {
  id: string; referralId: string; actorId: string; actorName: string;
  action: 'created' | 'status_changed'; candidateEmail: string;
  previousStatus?: ReferralStatus; status: ReferralStatus; createdAt: string;
}
export interface PageResult<T> { [key: string]: T[] | { page: number; limit: number; total: number; pages: number } }
