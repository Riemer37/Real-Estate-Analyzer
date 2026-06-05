import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return Response.json({ error: `Webhook fout: ${e.message}` }, { status: 400 });
  }

  const clerk = await clerkClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clerkUserId = session.client_reference_id;
      if (clerkUserId) {
        await clerk.users.updateUser(clerkUserId, {
          publicMetadata: {
            isPro: true,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription cancelled or expired — revoke Pro
      const subscription = event.data.object;
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (clerkUserId) {
        await clerk.users.updateUser(clerkUserId, {
          publicMetadata: { isPro: false },
        });
      }
      break;
    }

    // invoice.payment_failed: grace period still active, keep Pro until subscription.deleted
  }

  return Response.json({ received: true });
}
