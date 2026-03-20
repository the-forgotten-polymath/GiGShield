# GigShield User & Operator Guide 📖🛡️

Welcome to GigShield—the future of income protection for the gig economy.

## 🛠️ For Gig Workers (Raju's Guide)

### 1. PWA Installation
- Open the hosted URL in Chrome/Safari on your mobile.
- Tap "Add to Home Screen".
- Launch the Shield icon from your home screen.

### 2. The 7-Step Onboarding
- **Phone & OTP**: No password needed. Just your phone.
- **Profile**: Set your city and zone (e.g., Delhi East).
- **Tier Selection**: Choose your protection level (Bronze, Silver, Gold).
- **UPI Mandate**: Set up AutoPay on Razorpay. The first week's premium (~₹45-65) is debited to activate the shield.

### 3. Claiming Payouts
- **Zero Work**: You do not need to file a claim! 
- If your zone hits a "Heavy Rain" threshold, the shield activates automatically.
- Check your **WhatsApp** for an instant notification.
- Payouts are sent directly to your UPI ID via Track A/B/C routing based on your BCS (Behavioral Credibility Score).


## 🏛️ For Platform Operators (Admin Guide)

### 1. The Dashboard (`/admin`)
- Monitor the **Loss Ratio** in real-time.
- View **Active Ring Alerts** and take manual action (Block/Review).
- Adjust **Zone Risk Thresholds** for AQI and Weather events.

### 2. Manual Trigger Tests (Demo Only)
To test the payout flow:
1. Register a worker in "Zone 1".
2. Use the **Manual Trigger** tool in the admin panel to fire a "Simulated Storm".
3. Monitor the `payout` job queue in BullMQ dashboards.


## 🤖 For Developers (API & ML)

### Local Development
1. Start the services using Docker: `docker-compose up`.
2. Access logs: `docker logs -f backend`.
3. Run ML tests: `pytest ml-service/tests/`.

### Deployment Checklist
- Set `RAZORPAY_KEY_SECRET` in `.env`.
- Point `OWM_API_KEY` to a paid tier if handling >10 zones.
- Deploy `ml-service` to a GPU-enabled instance for high-throughput GNN inference if needed (though current NumPy version is optimized for CPU).
