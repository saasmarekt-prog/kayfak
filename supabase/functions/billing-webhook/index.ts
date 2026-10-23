import { withSupabase } from "npm:@supabase/server@1";
import Stripe from "npm:stripe@17";

Deno.serve(
  withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const productsRaw = Deno.env.get("BILLING_PRODUCTS_JSON");
    if (!secret || !webhookSecret || !productsRaw) return Response.json({ error: "Billing is not configured" }, { status: 503 });

    const stripe = new Stripe(secret);
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, req.headers.get("stripe-signature") ?? "", webhookSecret, undefined, cryptoProvider);
    } catch (_error) {
      return Response.json({ error: "Invalid billing webhook signature" }, { status: 401 });
    }

    if (event.type !== "checkout.session.completed") return Response.json({ received: true });
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata ?? {};
    const userId = metadata.user_id ?? session.client_reference_id;
    const productId = metadata.product_id;
    if (!userId || !productId || session.payment_status !== "paid") return Response.json({ received: true });

    if (session.mode === "subscription" && typeof session.subscription === "string") {
      const { error } = await ctx.supabaseAdmin.from("subscriptions").upsert({ user_id: userId, provider: "stripe", provider_subscription_id: session.subscription, plan_id: productId, status: "active", raw_event: event }, { onConflict: "provider,provider_subscription_id" });
      if (error) return Response.json({ error: "Subscription settlement failed" }, { status: 500 });
      return Response.json({ received: true });
    }

    const products = JSON.parse(productsRaw) as Record<string, { coins: number }>;
    const product = products[productId];
    if (!product || !Number.isSafeInteger(product.coins) || product.coins <= 0) return Response.json({ error: "Unknown server-side billing product" }, { status: 400 });
    const { error } = await ctx.supabaseAdmin.rpc("record_purchase_credit", { p_user_id: userId, p_provider: "stripe", p_provider_purchase_id: session.id, p_product_id: productId, p_coin_amount: product.coins, p_idempotency_key: `stripe:${session.id}`, p_raw_event: event });
    if (error) return Response.json({ error: "Purchase settlement failed" }, { status: 500 });
    return Response.json({ received: true });
  }),
);
