import resendService from '../service/resend-service';
import app from '../hono/hono';
import { bodyLimit } from 'hono/body-limit';
import { createResendWebhookHandler } from '../lib/resend-webhook';

app.post('/webhooks', bodyLimit({ maxSize: 256 * 1024 }),
	createResendWebhookHandler((c, event) => resendService.webhooks(c, event)));
