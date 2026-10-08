import { and, eq, inArray } from 'drizzle-orm';
import orm from '../entity/orm';
import email from '../entity/email';
import { emailConst } from '../const/entity-const';
import { getResendTransition } from '../lib/resend-events';

const resendService = {
	async webhooks(c, event) {
		const transition = getResendTransition(event);
		if (!transition) return;

		const { status, previous, resendEmailId, message } = transition;
		const record = await orm(c).update(email).set({ status, message }).where(and(
			eq(email.resendEmailId, resendEmailId),
			eq(email.type, emailConst.type.SEND),
			inArray(email.status, previous),
		)).returning({ emailId: email.emailId }).get();
		if (record) return;

		// A late/duplicate event is acknowledged. Events racing the send-record
		// insert must be retried by Resend rather than silently discarded.
		const existing = await orm(c).select({ emailId: email.emailId }).from(email).where(and(
			eq(email.resendEmailId, resendEmailId),
			eq(email.type, emailConst.type.SEND),
		)).limit(1).get();
		if (!existing) throw new Error('Sent email record is not available yet');
	},
};

export default resendService;
