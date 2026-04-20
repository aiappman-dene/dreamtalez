import Stripe from "stripe";

// Stripe instance created inside the function so missing keys don't crash on load
export async function createCheckoutSession(req, res) {
  if (!process.env.STRIPE_SECRET || !process.env.STRIPE_PRICE_ID) {
    return res.json({ disabled: true, message: "Payments coming soon" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: { uid: req.authUser?.uid || "" },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: "Could not start checkout. Please try again." });
  }
}
