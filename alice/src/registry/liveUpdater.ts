/**
 * Live updater — polls registered agents' live sources (Sovra API, Bob's API, etc.)
 * and writes the results into the registry so they appear on the dashboard.
 */

import { fetchSovraLiveSnapshot } from '../integrations/sovra';
import { fetchBobLiveSnapshot } from '../integrations/bob';
import { updateLiveState } from './agents';
import { logger } from '../utils/logger';
import { auditLog } from '../locus/audit';

const TICK_MS = 10000; // refresh every 10 seconds
let tickTimer: ReturnType<typeof setInterval> | null = null;

const LIVE_SOURCES: Record<number, 'sovra' | 'bob'> = {
  1: 'sovra',
  2: 'bob',
};

async function refreshSovra(): Promise<void> {
  try {
    const snapshot = await fetchSovraLiveSnapshot();
    updateLiveState(1, {
      source: 'sovra',
      fetchedAt: snapshot.fetchedAt,
      data: snapshot,
    });
    await auditLog('registry.live_update', {
      agentId: 1,
      name: 'Sovra',
      source: 'sovra',
      topBid: snapshot.auction.topBid
        ? {
            bidder: snapshot.auction.topBid.bidder,
            amountUsdc: snapshot.auction.topBid.amountUsdc,
            chain: snapshot.auction.topBid.chain,
          }
        : null,
      bidCount: snapshot.auction.bidCount,
      recentPosts: snapshot.recentPosts.length,
    });
  } catch (err) {
    await logger.error('registry.sovra.fetch_failed', { error: String(err) });
  }
}

async function refreshBob(): Promise<void> {
  try {
    const snapshot = await fetchBobLiveSnapshot();
    updateLiveState(2, {
      source: 'bob',
      fetchedAt: snapshot.fetchedAt,
      data: snapshot,
    });
    await auditLog('registry.live_update', {
      agentId: 2,
      name: 'bobIsAlive',
      source: 'bob',
      alive: snapshot.heartbeat.alive,
      balance: snapshot.heartbeat.balance,
      mood: snapshot.heartbeat.mood,
      ttd: snapshot.heartbeat.ttd,
      tickCount: snapshot.heartbeat.tickCount,
      tasksCompleted: snapshot.heartbeat.tasksCompleted,
    });
  } catch (err) {
    await logger.error('registry.bob.fetch_failed', { error: String(err) });
  }
}

async function tick(): Promise<void> {
  await Promise.all(
    Object.entries(LIVE_SOURCES).map(async ([_, source]) => {
      if (source === 'sovra') await refreshSovra();
      else if (source === 'bob') await refreshBob();
    })
  );
}

export function startLiveUpdater(): void {
  if (tickTimer) return;
  logger.info('registry.live_updater.start', { tickMs: TICK_MS });
  tick().catch(() => {});
  tickTimer = setInterval(() => {
    tick().catch((err) => logger.error('registry.live_updater.tick_error', err));
  }, TICK_MS);
}

export function stopLiveUpdater(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
