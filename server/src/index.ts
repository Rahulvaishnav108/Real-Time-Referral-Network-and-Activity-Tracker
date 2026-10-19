import http from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { config } from './config.js';
import { createApp } from './app.js';
import { User } from './models/User.js';
import { Organization } from './models/Organization.js';
import { createAccessToken } from './services/tokenService.js';
import { seedDemoReferrals } from './seed/demoReferrals.js';

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: config.CLIENT_ORIGIN, credentials: true }, transports: ['websocket', 'polling'] });

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    const { verify } = await import('jsonwebtoken');
    const claims = verify(token, config.JWT_ACCESS_SECRET) as { sub?: string; org?: string; role?: string; type?: string };
    if (claims.type !== 'access' || !claims.sub || !claims.org || !mongoose.isValidObjectId(String(claims.sub)) || !mongoose.isValidObjectId(String(claims.org))) return next(new Error('Invalid access token'));
    const current = await User.exists({ _id: claims.sub, organizationId: claims.org, role: claims.role });
    if (!current) return next(new Error('Session is no longer valid'));
    socket.data.userId = claims.sub;
    socket.data.organizationId = claims.org;
    socket.join(`org:${claims.org}`);
    next();
  } catch { next(new Error('Invalid or expired access token')); }
});

io.on('connection', (socket) => socket.emit('connection:ready', { organizationId: socket.data.organizationId }));

const app = createApp(io);
httpServer.on('request', app);

const start = async () => {
  await mongoose.connect(config.MONGODB_URI);
  let organization = await Organization.findOne({ slug: 'acme' });
  if (!organization) {
    organization = await Organization.create({ name: 'Acme Studio', slug: 'acme' });
  }
  const bcrypt = await import('bcryptjs');
  const adminEmail = 'admin@acme.test';
  const memberEmail = 'user@acme.test';
  let accountsCreated = 0;

  let adminUser = await User.findOne({ organizationId: organization._id, email: adminEmail });
  if (!adminUser) {
    adminUser = await User.create({ name: 'Avery Admin', email: adminEmail, passwordHash: await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD ?? 'DemoAdmin123!', 12), role: 'admin', organizationId: organization._id });
    accountsCreated += 1;
  }
  let memberUser = await User.findOne({ organizationId: organization._id, email: memberEmail });
  if (!memberUser) {
    memberUser = await User.create({ name: 'Jordan Member', email: memberEmail, passwordHash: await bcrypt.hash(process.env.DEMO_USER_PASSWORD ?? 'DemoUser123!', 12), role: 'user', organizationId: organization._id });
    accountsCreated += 1;
  }

  let otherOrg = await Organization.findOne({ slug: 'northstar' });
  if (!otherOrg) otherOrg = await Organization.create({ name: 'Northstar Labs', slug: 'northstar' });
  const northstarUser = await User.findOne({ organizationId: otherOrg._id, email: 'user@northstar.test' });
  if (!northstarUser) {
    await User.create({ name: 'Casey Member', email: 'user@northstar.test', passwordHash: await bcrypt.hash(process.env.DEMO_USER_PASSWORD ?? 'DemoUser123!', 12), role: 'user', organizationId: otherOrg._id });
    accountsCreated += 1;
  }
  if (accountsCreated > 0) console.info(`Created ${accountsCreated} missing demo account(s). See README for local credentials.`);

  if (adminUser.role === 'admin' && memberUser.role === 'user') {
    const count = await seedDemoReferrals(organization._id, adminUser._id, memberUser._id);
    if (count > 0) console.info(`Seeded ${count} sample referrals and their activity history in Acme Studio.`);
  } else {
    console.warn('Sample referrals were not seeded because the Acme demo users were not found.');
  }
  httpServer.listen(config.PORT, () => console.info(`Referral API listening on http://localhost:${config.PORT}`));
};

start().catch((error: unknown) => { console.error('Startup failed', error); process.exit(1); });

const shutdown = async () => { io.close(); await mongoose.disconnect(); process.exit(0); };
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
