import Razorpay from 'razorpay';
import { config } from '../config';
import { logger } from '../utils/logger';

let razorpay: Razorpay | null = null;

function getRazorpay() {
  if (!razorpay && config.razorpay.keyId) {
    razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpay;
}

export const razorpayService = {
  async createCustomer(params: { name: string; contact: string }): Promise<{ id: string }> {
    const client = getRazorpay();
    if (!client) {
      const mockId = `cust_mock_${Date.now()}`;
      logger.info(`[RAZORPAY MOCK] Create customer: ${params.contact} → ${mockId}`);
      return { id: mockId };
    }
    const customer = await client.customers.create({
      name: params.name,
      contact: params.contact,
    });
    return { id: String(customer.id) };
  },

  async createMandate(params: {
    customerId: string;
    upiId: string;
    maxAmount: number;
    description: string;
  }): Promise<{ id: string }> {
    if (!getRazorpay()) {
      const mockId = `mandate_mock_${Date.now()}`;
      logger.info(`[RAZORPAY MOCK] Create mandate for customer ${params.customerId} → ${mockId}`);
      return { id: mockId };
    }
    // Razorpay UPI AutoPay subscription creation
    const sub = await getRazorpay()!.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID || 'plan_mock',
      customer_notify: 1,
      total_count: 52, // 52 weeks = 1 year
      notes: { description: params.description },
    } as Parameters<typeof getRazorpay>['0'] extends undefined ? never : Parameters<Razorpay['subscriptions']['create']>[0]);
    return { id: String(sub.id) };
  },

  async initiatePayout(params: {
    amount: number; // in paise
    upiId: string;
    workerName: string;
    narration: string;
  }): Promise<{ id: string; utr: string }> {
    if (!getRazorpay()) {
      const mockId = `payout_mock_${Date.now()}`;
      const mockUtr = `UTR${Math.random().toString(36).substr(2, 12).toUpperCase()}`;
      logger.info(
        `[RAZORPAY MOCK] Payout ₹${params.amount / 100} to ${params.upiId} → ${mockId} UTR: ${mockUtr}`
      );
      return { id: mockId, utr: mockUtr };
    }

    // Razorpay Payout API (Sandbox)
    const payout = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: process.env.RAZORPAY_PAYOUT_ACCOUNT,
        amount: params.amount,
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        fund_account: {
          account_type: 'vpa',
          vpa: { address: params.upiId },
          contact: { name: params.workerName, type: 'employee' },
        },
        narration: params.narration,
        queue_if_low_balance: true,
      }),
    }).then((r) => r.json() as Promise<{ id: string; utr: string }>);

    return { id: payout.id, utr: payout.utr || '' };
  },
};
