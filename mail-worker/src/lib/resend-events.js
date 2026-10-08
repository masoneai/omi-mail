import { emailConst } from '../const/entity-const';

const { status } = emailConst;
const pending = [status.SENT, status.DELAYED];

const transitions = {
	'email.sent': { status: status.SENT, previous: [status.SENT] },
	'email.delivery_delayed': { status: status.DELAYED, previous: pending },
	'email.delivered': { status: status.DELIVERED, previous: [...pending, status.DELIVERED] },
	'email.bounced': { status: status.BOUNCED, previous: [...pending, status.DELIVERED, status.BOUNCED] },
	'email.complained': { status: status.COMPLAINED, previous: [...pending, status.DELIVERED, status.BOUNCED, status.COMPLAINED] },
	'email.failed': { status: status.FAILED, previous: [...pending, status.FAILED] },
};

export function getResendTransition(event) {
	const transition = Object.hasOwn(transitions, event?.type) ? transitions[event.type] : null;
	if (!transition) return null;
	if (typeof event.data?.email_id !== 'string' || !event.data.email_id.trim()) {
		throw new TypeError('Missing email ID');
	}

	let message = null;
	if (event.type === 'email.bounced' && event.data.bounce) message = JSON.stringify(event.data.bounce);
	if (event.type === 'email.failed') message = event.data.failed?.reason || null;

	return { ...transition, resendEmailId: event.data.email_id, message };
}
