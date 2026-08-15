# Recommended Connect integration plan — Hustle

## Business summary

| | |
|---|---|
| Business type | Services marketplace |
| Sellers / providers | Hustle users — freelancers selling websites |
| Buyers / customers | Local businesses the freelancer pitched |
| How money flows | Client pays an invoice raised in Hustle → Hustle keeps 30% → 70% to the freelancer |
| Fee structure | 30% commission per transaction, **plus** the existing Free / Pro / Max subscription |

## Recommended configuration

- **Dashboard:** Express — Stripe hosts the freelancer's payouts and tax views, so you don't build them
- **Fees:** platform owns pricing and collects fees (`fees_collector: "application"`)
- **Negative balance liability:** platform owns it (`losses_collector: "application"`)
- **Charge pattern:** **destination charges**, with your 30% as `application_fee_amount`

### Why destination charges

Hustle raises the invoice and owns the checkout, so the payment is yours and the split is
automatic — Stripe moves 70% to the freelancer's connected account and leaves your 30%
behind, in a single API call. It also guarantees your cut: you never have to chase a
freelancer who was paid directly and then owes you commission.

Direct charges would make the freelancer the merchant of record, which arguably matches
who does the work — but it puts them in charge of the payment, and pulling your fee back
becomes their problem to honour. For a marketplace taking a fixed cut, destination is the
right default.

### Compatibility notes

- **Express + platform-collected fees is a valid pairing.** (Express with Stripe-collected
  fees is blocked — don't switch `fees_collector` to `"stripe"` later without also moving
  to a full dashboard.)
- **Destination charges require the platform to own negative balance liability.** On a
  dispute, Stripe debits *your* balance; recovering it means reversing the transfer, which
  is not automatic. Budget for chargebacks and set `reverse_transfer` deliberately.
- **Caution:** with destination charges, embedded payment and dispute views show reduced
  detail compared with direct charges. Fine here — freelancers mostly care about payouts.

### Margin

30% sits far above Stripe's processing rates, so there is no thin-margin risk. Still
calculate `application_fee_amount` as *your 30% + the estimated processing fee* if you want
30% net rather than 30% gross. See [stripe.com/pricing](https://stripe.com/pricing).

## Embedded components to build against

Baseline: `account_onboarding`, `notification_banner`, `account_management`
Add: `payouts` (freelancer earnings), `payments` (transaction history)

## In your code

- Create a connected account per user at first payout setup; store its id on the profile
- Raise the invoice as a PaymentIntent with `transfer_data.destination` + `application_fee_amount`
- Webhooks: `account.updated` (capability/payout readiness), `payment_intent.succeeded`,
  `charge.dispute.created`, `payout.*`
- Gate "send invoice" on the account having `charges_enabled` and `payouts_enabled`

## In the Stripe Dashboard

- Platform profile + Connect settings
- Platform Pricing Tool, if you want Stripe to compute your fee
- Radar for Platforms
- Margin report for ongoing monitoring

## Open risk — platform country

Connect requires **your company** to be registered in a Stripe-supported country. Sellers
can be almost anywhere (45+ countries), but the platform entity cannot. If the entity ends
up somewhere unsupported, this whole model is blocked and the options are:

1. Incorporate a US entity (Stripe Atlas, ~1 week), or
2. Drop the 30% split and monetise via subscription only — no Connect, no KYC, no payout
   liability, no money-transmission surface

Confirm the entity's country before building any of this.
