import { Resend } from 'resend';
import { getResendTransition } from './resend-events';

// Signature verification is local; this client never makes API requests.
const verifier = new Resend('webhook-verification');

export function createResendWebhookHandler(applyEvent) {
	return async (c) => {
		const webhookSecret = c.env.resend_webhook_secret;
		if (!webhookSecret) return c.text('Webhook signing secret is not configured', 503);

		let event;
		try {
			event = verifier.webhooks.verify({
				payload: await c.req.text(),
				headers: {
					id: c.req.header('svix-id'),
					timestamp: c.req.header('svix-timestamp'),
					signature: c.req.header('svix-signature'),
				},
				webhookSecret,
			});
		} catch {
			return c.text('Invalid webhook signature', 401);
		}

		try {
			if (!getResendTransition(event)) return c.text('success', 200);
		} catch {
			return c.text('Invalid webhook event', 400);
		}

		try {
			await applyEvent(c, event);
			return c.text('success', 200);
		} catch (error) {
			console.error('Resend webhook processing failed', error);
			return c.text('Webhook processing failed', 500);
		}
	};
}
