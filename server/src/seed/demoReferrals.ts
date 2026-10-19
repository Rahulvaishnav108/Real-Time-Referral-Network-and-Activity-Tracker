import type { Types } from 'mongoose';
import { ActivityEvent } from '../models/ActivityEvent.js';
import { Referral } from '../models/Referral.js';

type DemoReferral = {
  email: string;
  note: string;
  status: 'pending' | 'contacted' | 'accepted' | 'rejected';
  creatorId: Types.ObjectId;
  creatorName: string;
  createdDaysAgo: number;
  updatedDaysAgo: number;
};
type SeedEvent = {
  organizationId: Types.ObjectId;
  referralId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorName: string;
  action: 'created' | 'status_changed';
  candidateEmail: string;
  previousStatus?: 'pending';
  status: DemoReferral['status'];
  createdAt: Date;
};

const dateDaysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export async function seedDemoReferrals(organizationId: Types.ObjectId, adminId: Types.ObjectId, memberId: Types.ObjectId): Promise<number> {
  const samples: DemoReferral[] = [
    { email: 'alex.morgan@example.com', note: 'Senior product designer with strong B2B experience.', status: 'pending', creatorId: memberId, creatorName: 'Jordan Member', createdDaysAgo: 0, updatedDaysAgo: 0 },
    { email: 'samira.patel@example.com', note: 'Engineering lead interested in mission-driven teams.', status: 'contacted', creatorId: memberId, creatorName: 'Jordan Member', createdDaysAgo: 2, updatedDaysAgo: 1 },
    { email: 'miles.chen@example.com', note: 'Experienced data analyst; excellent cross-functional partner.', status: 'accepted', creatorId: adminId, creatorName: 'Avery Admin', createdDaysAgo: 5, updatedDaysAgo: 2 },
    { email: 'noah.williams@example.com', note: 'Frontend engineer with a thoughtful accessibility portfolio.', status: 'rejected', creatorId: memberId, creatorName: 'Jordan Member', createdDaysAgo: 9, updatedDaysAgo: 7 },
    { email: 'olivia.ross@example.com', note: 'Customer success manager with a track record of scaling teams.', status: 'pending', creatorId: adminId, creatorName: 'Avery Admin', createdDaysAgo: 12, updatedDaysAgo: 12 }
  ];

  let createdCount = 0;
  for (const sample of samples) {
    const candidateEmail = sample.email.toLowerCase();
    const alreadyExists = await Referral.exists({ organizationId, candidateEmail });
    if (alreadyExists) continue;

    const createdAt = dateDaysAgo(sample.createdDaysAgo);
    const statusUpdatedAt = dateDaysAgo(sample.updatedDaysAgo);
    const referral = await Referral.create({
      organizationId,
      createdBy: sample.creatorId,
      candidateEmail,
      note: sample.note,
      status: sample.status,
      createdAt,
      statusUpdatedAt
    });

    const events: SeedEvent[] = [{
      organizationId,
      referralId: referral._id,
      actorId: sample.creatorId,
      actorName: sample.creatorName,
      action: 'created',
      candidateEmail,
      status: 'pending',
      createdAt
    }];

    if (sample.status !== 'pending') {
      events.push({
        organizationId,
        referralId: referral._id,
        actorId: adminId,
        actorName: 'Avery Admin',
        action: 'status_changed',
        candidateEmail,
        previousStatus: 'pending',
        status: sample.status,
        createdAt: statusUpdatedAt
      });
    }

    await ActivityEvent.insertMany(events);
    createdCount += 1;
  }

  return createdCount;
}
