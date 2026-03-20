GigShield  Devpost Submission · Phase 1 · Seed

Project Title
GigShield  AI-Powered Parametric Income Insurance for India's Gig Workers

Inspiration
We didn't find this problem in a dataset. We found it in a sentence.
"Baarish mein koi order nahi aata. Poora din barbaad. Ek hafte ki mehnat pe paani pher jaata hai." (In rain, no orders come. The whole day is wasted. A week's work gets washed away.)
That's Raju  26 years old, Swiggy delivery partner in Koramangala, Bangalore. Earns ₹720/day. Zero savings buffer. Rents a room for ₹4,500/month. Has never bought insurance. Thinks it's for rich people.
Raju loses 20–30% of his monthly income every monsoon. Not because he's lazy or unlucky  because it rains. Because Swiggy suspends his zone. Because a Red Alert means he can't work for 6 hours and loses ₹400 he already mentally spent on groceries. This happens 18–26 times a year to every gig delivery worker in India.
Not one insurance product in India covers this. Ola and Uber offer accident cover  Raju's healthy. Plum offers group health plans  Raju's physically fine. ESIC covers occupational hazard  Raju just can't work because of weather. Every adjacent product addresses a different problem. The "I'm healthy but I can't earn" gap is completely uninsured.
We were inspired by parametric insurance  a model proven in agriculture (rainfall-triggered crop insurance) and catastrophe bonds  and asked one question: what if we applied it to urban gig workers at ₹49 a week, paid via UPI before Raju even knows to ask?
That question became GigShield.

What It Does
GigShield is India's first AI-powered parametric income insurance platform built exclusively for food delivery workers on Zomato and Swiggy. It automatically pays workers  via UPI in under 4 minutes  when verified external disruptions destroy their earning capacity.
The core promise: When a storm, an AQI emergency, or a zone disruption hits, GigShield pays Raju automatically. Zero claim filing. Zero paperwork. Zero waiting. He didn't even know it was happening.
How it works, end to end:
Onboarding (3 minutes, one time): OTP login, link Swiggy worker ID, pick delivery zone, set UPI AutoPay mandate. Done. Covered.
Weekly coverage (₹29 / ₹49 / ₹79 per week): Every Sunday night our ML pricing engine recalculates next week's risk-adjusted premium  accounting for 7-day weather forecast, zone flood history, seasonal risk  and notifies Raju of any change before Monday's auto-debit. He always sees the "why" before the money moves.
24×7 monitoring: Our backend continuously polls OpenWeatherMap, IMD, and CPCB, while our internal order-volume monitor tracks aggregate worker activity across all enrolled subscribers in each zone. No Swiggy API required  we build our own real-time zone disruption signal from GigShield's own data. The more workers enroll, the more accurate the signal. This is the data moat.
Automated payout: The moment a threshold is breached  IMD Red Alert confirmed, AQI above 400 sustained, >85% order-volume collapse in the zone  our system validates Raju's active policy, computes a 12-signal Behavioral Credibility Score, calculates the payout amount, and initiates a Razorpay UPI transfer. Raju's phone buzzes with ₹275 credited. He didn't do anything.
Fraud defense: Our 12-signal BCS and rule-based ring detection engine mean a GPS spoofer gets a BCS of 11. Raju, genuinely stranded, gets a BCS of 91. Both are processed simultaneously. Raju gets paid in 4 minutes. The fraud ring gets nothing  and is flagged for investigation.
WhatsApp as primary channel: During a storm, Raju's app might not load. WhatsApp works on 1-bar signal. "STATUS" → instant coverage confirmation. "PAYOUT" → last 3 payouts with amounts. Every critical action works over WhatsApp. This is not a nice-to-have  it's the channel that works in the exact moment that matters most.

How We Built It
Every architectural decision was made by starting with Raju  his device, his data plan, his network during a storm  not by starting with what's technically impressive.
The platform decision: Mobile-first PWA, not a native app. 97% of delivery workers use Android (₹8k–₹14k phones). They distrust new app downloads. Storage is scarce. Network degrades to 2G exactly when they need us most. A PWA installs from the browser, caches offline aggressively, and works on 2G. WhatsApp handles everything else.
The trigger architecture decision: We deliberately avoided dependency on a Swiggy/Zomato platform API  no such public API exists, and building on it would make the product fragile. Instead, our T4 trigger (zone disruption) is computed from aggregate enrolled worker behavior across our own platform: if >85% of GigShield-enrolled workers in a zone go inactive simultaneously, that is a disruption signal  no platform cooperation required. This is both more reliable and more defensible.
The fraud defense architecture: We separated two questions that most systems conflate. (1) "Did the disruption event actually happen?"  answered by external APIs, unaffectable by any individual worker. (2) "Was this specific worker genuinely present?"  answered by the BCS engine. A fraudster can fake their GPS. They cannot simultaneously fabricate 12 coherent signals across physical sensors, network infrastructure, behavioral patterns, and account history.
The unit economics decision: We modeled the loss ratio honestly. Expected weekly payout for Standard tier (~₹87/week) exceeds the ₹49 launch premium. This is deliberate  the Acko/Digit playbook. Year 1: acquire at a loss, build the proprietary data asset. Year 2: dynamic repricing to actuarial reality. Year 3: reinsurance partnership handles tail risk; product reaches profitability. We don't pretend it works on day one. We show how it gets there.
The regulatory model: GigShield operates as an insurtech distribution and automation layer under an IRDAI-licensed insurer partnership  analogous to Digit Insurance's embedded product model. The licensed insurer underwrites the risk; GigShield provides the technology and distribution. For Phase 1: sandbox prototype. GTM path runs through IRDAI's Regulatory Sandbox framework, specifically designed for innovative parametric products.
Stack: React.js PWA (Workbox, Tailwind, Zustand, FCM, i18next) + Node.js/Express backend + PostgreSQL + Redis + Bull queue + Python FastAPI ML microservice (XGBoost, Isolation Forest, PyTorch/PyTorch Geometric) + Razorpay + Twilio WhatsApp + OpenWeatherMap + CPCB API + Firebase Auth.

Challenges We Ran Into
1. The platform API that doesn't exist. Our initial architecture leaned heavily on a real-time Swiggy/Zomato zone suspension API. Halfway through design, we confronted the obvious: this API doesn't exist publicly, and building the product on it would make us permanently dependent on platform goodwill. The pivot  computing zone disruption from aggregate enrolled worker behavior on our own platform  was harder to design but produced a genuinely stronger architecture. The data moat is now ours, not theirs.
2. The Market Crash adversarial challenge. The 24-hour challenge forced us to re-examine our fraud assumptions from scratch. The hardest design problem: during a genuine storm, GPS drifts, cell towers get overloaded, network degrades. Every signal that identifies a fraudster also appears (in degraded form) on a genuine worker caught in bad conditions. The solution  the Storm Exception Protocol  was the insight that changed the architecture. The macro trigger is already confirmed by external APIs. We don't need perfect individual-level signals when the event's reality is independently verified. Lower the individual threshold when the macro is confirmed. The storm is the ground truth.
3. The unit economics math. Our first attempt at unit economics had a fundamental error  we understated expected payouts by 3–4×. When we corrected the actuarial math (expected weekly payout ~₹87 vs. ₹49 premium), we had a choice: paper over it, or design the business model around it honestly. We chose honesty  and the Acko/Digit repricing playbook is a better story for Guidewire judges than a fake profitable unit cost.
4. The GNN training data problem. Claiming a trained GraphSAGE fraud ring detector in Phase 1 is architecturally credible but practically dishonest  you need labelled fraud graphs to train it. The solution: a two-phase ML roadmap. Phase 1–2: rule-based clustering generates confirmed ring labels. Phase 3: GraphSAGE trains on those labels. The system generates its own training data as it operates. This is more credible, more buildable, and more honest than claiming a trained model we haven't built.
5. Designing for zero insurance literacy. Every copy decision, every UX flow, every notification had to work for someone who has never interacted with insurance in any form. "Your policy renewal is due" means nothing to Raju. "₹49 deducted. You're covered this week ✅" means everything. The UX work was as hard as the ML architecture.

Accomplishments We're Proud Of
The platform-independent T4 trigger. Computing zone disruption from aggregate enrolled worker behavior  without any platform API  means GigShield generates a proprietary real-time signal that improves with scale and that no competitor can replicate. This is an architectural insight we didn't start with.
The fraud defense architecture. Separating "did the event happen" (external APIs) from "was this worker genuinely present" (BCS) means fraudsters cannot exploit the trigger system because they can't fake the macro event, and cannot fake 12 simultaneously coherent signals for the individual check. The Storm Exception Protocol closes the last loophole  lowering individual thresholds when the macro is already confirmed, without creating an exploitable vulnerability.
The honest actuarial model. We found and fixed our own unit economics error instead of presenting comfortable fiction to judges who know insurance. The repricing roadmap is more credible than a profitable-from-day-one fantasy.
The two-phase ML architecture. Rule-based ring detection in Phase 1 generates the training labels for the Phase 3 GNN. The system bootstraps its own ML training data. This is real-world ML engineering, not slide-deck ML.
The weekly premium model. ₹49 auto-debited Monday morning after the weekend's earnings  designed around how Raju actually manages money, not how insurance actuaries assume he should.

What We Learned
The data moat is the product. GigShield's most valuable asset is not the PWA or the ML models  it's the proprietary, real-time zone disruption intelligence generated by enrolled worker behavior. Every additional worker who enrolls makes the T4 trigger more accurate. This network effect is the real competitive advantage.
Parametric insurance's strength is also its attack surface. The automation that makes parametric insurance efficient (no human review, instant payout) is precisely what makes it a fraud target. The architecture must treat fraud as a first-class design constraint, not an afterthought.
Honest actuarial framing beats confident wrong numbers. Especially when the judges are from Guidewire  an insurance company. Domain experts can tell when unit economics don't add up. Showing a credible path to profitability through dynamic repricing is more impressive than fabricating margins.
WhatsApp is infrastructure, not a feature. The realization that WhatsApp must be a primary channel  not a fallback  changed how we think about resilient product design for this demographic.
The hardest product problems were UX, not ML. Getting Raju to trust a product he's never heard of, in a category he's never used, through a 3-minute onboarding, with copy he can understand  that required more iteration than the fraud detection architecture.

What's Next for GigShield
Phase 2 (March 21 – April 4): Build every screen of the PWA. Wire live weather and pollution triggers. Build the internal order-volume monitor as the platform-independent T4 signal. Integrate Razorpay UPI AutoPay and payout sandbox. Deploy the 12-signal rule-weighted BCS engine. Launch WhatsApp bot with 5 commands. Deliver a full end-to-end demo where a simulated Red Alert fires, BCS computes, and ₹275 hits a UPI in under 5 minutes.
Phase 3 (April 5–17): Train Isolation Forest on live claim data. Bootstrap the GraphSAGE GNN from rule-based ring detection labels. Build admin dashboard with live loss ratio analytics, zone disruption heat maps, and ring cluster alerts. Run the 100-worker, 60-account-ring E2E simulation. Final pitch, final demo.
The longer play: GigShield's distribution model is embedded partnerships with Zomato and Swiggy  surfacing insurance inside the delivery partner app at onboarding, after a hard weather week, when the payout notification appears in the same feed as weekly earnings. Platform owns distribution; GigShield owns the product. IRDAI Regulatory Sandbox for a 10,000-subscriber live pilot in two cities. Full commercial launch under licensed insurer partnership in Year 2.
The 12.6 million workers addressable today are just food delivery. The identical architecture serves ride-sharing, construction day labor, agricultural migrant workers  any worker whose income is disrupted by verifiable external events and who is too informal for traditional insurance to reach.
₹49 a week. Payout in 4 minutes. Built for the workers who've never been built for.

Built With
react node.js express postgresql redis python xgboost pytorch pytorch-geometric fastapi scikit-learn razorpay firebase twilio openweathermap-api cpcb-api docker github-actions vercel railway tailwindcss workbox pwa google-maps-api bull zustand i18next sentry

Try It Out
Live Demo: [Add deployed PWA link] Demo Video: [Add YouTube/Drive link] GitHub: [Add repository link]

Built for Guidewire DEVTrails 2026 · Phase 1 · Seed "Because every delivery partner deserves a safety net."

