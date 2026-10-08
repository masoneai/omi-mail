import PostalMime from 'postal-mime';
import emailService from '../service/email-service';
import accountService from '../service/account-service';
import settingService from '../service/setting-service';
import attService from '../service/att-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { emailConst, isDel, settingConst } from '../const/entity-const';
import emailUtils from '../utils/email-utils';
import roleService from '../service/role-service';
import userService from '../service/user-service';
import telegramService from '../service/telegram-service';
import aiService from '../service/ai-service';
import webhookService from '../service/webhook-service';
import { checkBlock, normalizeParsedEmail, readRawEmail, recipientName, splitEmailSetting } from './email-helpers';

export async function email(message, env, ctx) {

	try {

		const {
			receive,
			tgChatId,
			tgBotStatus,
			forwardStatus,
			forwardEmail,
			webhookStatus,
			webhookUrl,
			webhookRetry,
			webhookSecret,
			ruleEmail,
			ruleType,
			r2Domain,
			noRecipient,
			blackSubject,
			blackContent,
			blackFrom,
			aiCode,
			aiCodeFilter
		} = await settingService.query({ env });

		if (receive === settingConst.receive.CLOSE) {
			message.setReject('Service suspended');
			return;
		}

		// Reject recipient-level failures before buffering or parsing MIME data.
		let account = await accountService.selectByEmailIncludeDel({ env: env }, message.to);

		if (!account) {
			const baseEmail = emailUtils.getBaseEmail(message.to);
			if (baseEmail && baseEmail !== message.to) {
				account = await accountService.selectByEmailIncludeDel({ env: env }, baseEmail);
			}
		}

		if (!account && noRecipient === settingConst.noRecipient.CLOSE) {
			message.setReject('Recipient not found');
			return;
		}

		let banEmail = '';
		if (account) {
			const userRow = await userService.selectByIdIncludeDel({ env }, account.userId);
			if (!userRow) {
				message.setReject('Recipient not found');
				return;
			}
			if (userRow.email !== env.admin) {
				const role = await roleService.selectByUserId({ env }, account.userId);

				// A LEFT JOIN can return an object with null permission fields when
				// the account's role is missing. Do not treat that as unrestricted.
				if (!role || typeof role.availDomain !== 'string' || typeof role.banEmail !== 'string' || !roleService.hasAvailDomainPerm(role.availDomain, message.to)) {
					message.setReject('The recipient is not authorized to use this domain.');
					return;
				}

				banEmail = role.banEmail;
				if (splitEmailSetting(banEmail).includes('*')) {
					message.setReject('The recipient is disabled from receiving emails.');
					return;
				}
			}
		}

		const rawEmail = await readRawEmail(message.raw);
		const email = normalizeParsedEmail(await PostalMime.parse(rawEmail.buffer), message.from, message.to);
		if (checkBlock(blackSubject, blackContent, blackFrom, email)) {
			message.setReject('Message rejected');
			return;
		}

		// Sender-specific bans still use the parsed From header, as before.
		if (banEmail && roleService.isBanEmail(banEmail, email.from.address)) {
			message.setReject('The recipient is disabled from receiving emails.');
			return;
		}

		const toName = recipientName(email.to, message.to);
		const code = await aiService.extractCode({ env }, email, { aiCode, aiCodeFilter });

		const params = {
			toEmail: message.to,
			toName: toName,
			sendEmail: email.from.address,
			name: email.from.name || emailUtils.getName(email.from.address),
			subject: email.subject,
			code,
			content: email.html,
			text: email.text,
			cc: email.cc ? JSON.stringify(email.cc) : '[]',
			bcc: email.bcc ? JSON.stringify(email.bcc) : '[]',
			recipient: JSON.stringify(email.to),
			inReplyTo: email.inReplyTo,
			relation: email.references,
			messageId: email.messageId,
			userId: account ? account.userId : 0,
			accountId: account ? account.accountId : 0,
			isDel: isDel.DELETE,
			status: emailConst.status.SAVING
		};

		const attachments = [];
		const cidAttachments = [];

		for (let item of email.attachments) {
			let attachment = { ...item };
			attachment.key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(attachment.content) + fileUtils.getExtFileName(item.filename);
			attachment.size = item.content.length ?? item.content.byteLength;
			attachments.push(attachment);
			if (attachment.contentId) {
				cidAttachments.push(attachment);
			}
		}

		let emailRow = await emailService.receive({ env }, params, cidAttachments, r2Domain);

		attachments.forEach(attachment => {
			attachment.emailId = emailRow.emailId;
			attachment.userId = emailRow.userId;
			attachment.accountId = emailRow.accountId;
		});

		try {
			if (attachments.length > 0) {
				await attService.addAtt({ env }, attachments);
			}
			emailRow = await emailService.completeReceive({ env }, account ? emailConst.status.RECEIVE : emailConst.status.NOONE, emailRow.emailId);
		} catch (e) {
			// A failed attachment write must not turn into a successful delivery.
			// Remove this incomplete row so a retry does not leave a duplicate.
			try {
				await emailService.physicsDelete({ env }, { emailIds: String(emailRow.emailId) });
			} catch (cleanupError) {
				console.error('清理未完成邮件失败: ', cleanupError);
			}
			throw e;
		}


		if (ruleType === settingConst.ruleType.RULE) {

			const emails = splitEmailSetting(ruleEmail);

			if (!emails.includes(message.to)) {
				return;
			}

		}

		const notifications = [];
		// Network notifications run only after the email and attachments are saved.
		if (tgBotStatus === settingConst.tgBotStatus.OPEN && tgChatId) {
			notifications.push(Promise.resolve().then(() => telegramService.sendEmailToBot({ env }, emailRow)));
		}
		if (webhookStatus === settingConst.webhookStatus.OPEN && webhookUrl) {
			notifications.push(Promise.resolve().then(() => webhookService.sendEmail({ env }, emailRow, webhookUrl, webhookRetry, webhookSecret)));
		}
		const notificationTask = Promise.allSettled(notifications).then(results => {
			for (const result of results) {
				if (result.status === 'rejected') console.error('邮件通知失败: ', result.reason);
			}
		});
		if (ctx?.waitUntil) {
			ctx.waitUntil(notificationTask);
		} else {
			await notificationTask;
		}

		//转发到其他邮箱
		if (forwardStatus === settingConst.forwardStatus.OPEN && forwardEmail) {

			const emails = splitEmailSetting(forwardEmail);

			await Promise.all(emails.map(async email => {

				try {
					await message.forward(email);
				} catch (e) {
					console.error(`转发邮箱 ${email} 失败：`, e);
				}

			}));

		}

	} catch (e) {
		console.error('邮件接收异常: ', e);
		throw e;
	}
}
