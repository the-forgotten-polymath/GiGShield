import { queryOne } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PremiumCalculation } from './premiumEngine';

// Lazy init Twilio client
let twilioClient: ReturnType<typeof import('twilio')> | null = null;

function getTwilio() {
  if (!twilioClient && config.twilio.accountSid && config.twilio.authToken) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

export const notificationService = {
  async sendWhatsApp(to: string, body: string): Promise<void> {
    const client = getTwilio();
    if (!client) {
      logger.info(`[WhatsApp MOCK] to=${to}: ${body.slice(0, 80)}`);
      return;
    }
    try {
      await (client as { messages: { create: (opts: Record<string, string>) => Promise<unknown> } })
        .messages.create({ from: config.twilio.whatsappFrom, to, body });
    } catch (err) {
      logger.error('WhatsApp send failed', err);
    }
  },

  async sendPayoutSuccess(workerId: string, amount: number): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;

    const amountStr = `₹${Math.round(amount)}`;
    const hiMsg = `⚡ GigShield: Aapke zone mein disruption detect hua. Aapka ${amountStr} ka income protect kar diya gaya. UPI check karein. Safe rahein! 🛡️`;
    const enMsg = `⚡ GigShield: Disruption detected in your zone. ${amountStr} income protected. Check your UPI. Stay safe! 🛡️`;

    const msg = w.language === 'hi' ? hiMsg : enMsg;
    logger.info(`[NOTIFY PAYOUT] worker ${workerId}: ${amountStr}`);
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },

  async sendSoftFlag(workerId: string, amount: number): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;
    const msg = w.language === 'hi'
      ? `⏳ GigShield: Aapka payout processing mein hai. ₹${Math.round(amount)} ~2 ghante mein aayega. 🛡️`
      : `⏳ GigShield: Your payout of ₹${Math.round(amount)} is processing. Expected in ~2 hours. 🛡️`;
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },

  async sendHoldNotification(workerId: string, claimId: string): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;
    const msg = w.language === 'hi'
      ? `⚠️ GigShield: Aapke claim mein kuch unusual signals mile hain (Claim #${claimId.slice(-6)}). 24 ghante mein review hoga. Koi dikkat ho toh reply karein.`
      : `⚠️ GigShield: We noticed some unusual signals on your claim (Claim #${claimId.slice(-6)}). Review in 24 hours. Reply if you need help.`;
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },

  async sendBlockedNotification(workerId: string, claimId: string): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;
    const msg = w.language === 'hi'
      ? `🔒 GigShield: Aapka claim security review mein hai (Claim #${claimId.slice(-6)}). 48 ghante mein jawab milega. Appeal: gigshield.in/appeal`
      : `🔒 GigShield: Your claim is under security review (Claim #${claimId.slice(-6)}). Response in 48 hours. Appeal: gigshield.in/appeal`;
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },

  async sendCoverageActivated(workerId: string, premium: number, tier: string): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;
    const tierLabels: Record<string, string> = { lite: 'Kavach Lite', standard: 'Kavach Standard', pro: 'Kavach Pro' };
    const msg = w.language === 'hi'
      ? `✅ GigShield: ₹${premium} deduct hua. Is hafte aap covered hain! (${tierLabels[tier] || tier}) 🛡️`
      : `✅ GigShield: ₹${premium} deducted. You're covered this week! (${tierLabels[tier] || tier}) 🛡️`;
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },

  async sendPremiumPreNotification(workerId: string, premiumInfo: PremiumCalculation): Promise<void> {
    const w = await getWorkerContact(workerId);
    if (!w) return;

    const delta = premiumInfo.finalPremium - premiumInfo.basePremium;
    const deltaStr = delta > 0 ? `+₹${delta}` : delta < 0 ? `-₹${Math.abs(delta)}` : 'no change';

    const msg = w.language === 'hi'
      ? `📢 GigShield: Kal Somwar ko ₹${premiumInfo.finalPremium} ka premium deduct hoga (${deltaStr}). Sab kuch sahi chal raha hai. 🛡️`
      : `📢 GigShield: Tomorrow (Monday) ₹${premiumInfo.finalPremium} will be auto-debited (${deltaStr}). You're in good hands. 🛡️`;
    await this.sendWhatsApp(`whatsapp:${w.phone}`, msg);
  },
};

async function getWorkerContact(workerId: string) {
  return queryOne<{ phone: string; language: string }>(
    'SELECT phone, language FROM workers WHERE id = $1',
    [workerId]
  );
}
