import Stripe from 'stripe';
import { ENV } from '../config/env.js';
import { User } from '../models/user.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { Cart } from '../models/cart.model.js';

const stripe = new Stripe(ENV.STRIPE_SECRET_KEY);

export async function createPaymentIntent(req, res) {
    try {
        const { cartItems, shippingAddress } = req.body;
        const user = req.user;

        // validate cart items
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // calculate total amount
        let subtotal = 0;
        const validatedItems = [];

        for (const item of cartItems) {
            const product = await Product.findById(item.productId);

            if (!product) {
                return res.status(404).json({
                    message: `Product with id ${item.productId} not found`
                });
            }

            if (item.quantity > product.stock) {
                return res.status(400).json({
                    message: `Not enough stock for product ${product.name}`
                });
            }

            subtotal += product.price * item.quantity;

            validatedItems.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity,
                image: product.images[0]   // ✅ typo fixed
            });
        }

        const shipping = 10.0;
        const tax = subtotal * 0.08;
        const total = subtotal + tax + shipping;

        if (total <= 0) {
            return res.status(400).json({ message: "Total amount must be greater than 0" });
        }

        let customer;

        if (user.stripeCustomerId) {
            customer = await stripe.customers.retrieve(user.stripeCustomerId);
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                metadata: {
                    clerkId: user.clerkId,
                    userId: user.id.toString(),
                },
            });

            await User.findByIdAndUpdate(user.id, { stripeCustomerId: customer.id });
        }

        // create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100),
            currency: 'usd',
            customer: customer.id,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                clerkId: user.clerkId,
                userId: user.id.toString(),
                orderItems: JSON.stringify(validatedItems),
                shippingAddress: JSON.stringify(shippingAddress),
                total: total.toFixed(2),
            }
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, ENV.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        
        const paymentIntent = event.data.object;

      try {
        const { userId, clerkId, orderItems, shippingAddress, totalPrice } = paymentIntent.metadata;

        const existingOrder = await Order.findOne({ "paymentResult.id": paymentIntent.id });
        if (existingOrder) {
            console.log(`Order already exists for payment intent ${paymentIntent.id}`);
            return res.status(200).json({ message: "Order already processed" });
        }
        // create order
        const order = await Order.create({
            user: userId,
            clerkId: clerkId,
            OrderItems: JSON.parse(orderItems),
            shippingAddress: JSON.parse(shippingAddress),
            paymentResult: {
                id: paymentIntent.id,
                status: "succeeded",
            },
            totalPrice: parseFloat(totalPrice),
        });

        // update product stock
        const items = JSON.parse(orderItems);
        for (const item of items) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
        }

        console.log(`Order ${order._id} created successfully for payment intent ${paymentIntent.id}`);

      
    } catch (error) {
        console.error("Error processing order in webhook:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

res.status(200).json({ received: true });
 
}

