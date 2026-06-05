import Stripe from 'stripe';
import { auth } from '@clerk/nextjs/server';

export async function POST(req) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Stripe is nog niet geconfigureerd. Voeg STRIPE_SECRET_KEY toe aan .env.local.' }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Inloggen vereist' }, { status: 401 });
  }

  const { annual } = await req.json();
  const priceId = annual
    ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID
    : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

  if (!priceId) {
    return Response.json({ error: 'Stripe price ID niet geconfigureerd' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { clerkUserId: userId },
    },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/pricing?success=true`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return Response.json({ url: session.url });
}
