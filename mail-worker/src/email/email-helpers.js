// Keep the RFC 822 input as bytes: MIME text and attachments can use different
// encodings, and a multibyte character may span two stream chunks.
export async function readRawEmail(stream) {
	const reader = stream.getReader();
	const chunks = [];
	let length = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			length += value.byteLength;
		}
	} finally {
		reader.releaseLock();
	}

	if (chunks.length === 1 && chunks[0].byteOffset === 0 && chunks[0].byteLength === chunks[0].buffer.byteLength) return chunks[0];
	const content = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		content.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return content;
}

export function splitEmailSetting(value) {
	return typeof value === 'string' ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function normalizeAddresses(addresses) {
	if (!Array.isArray(addresses)) return [];
	return addresses.flatMap(item => {
		if (!item || typeof item !== 'object') return [];
		// PostalMime represents a named RFC 5322 group as { name, group }.
		if (Array.isArray(item.group)) return normalizeAddresses(item.group);
		if (typeof item.address !== 'string' || !item.address.trim()) return [];
		return [{ ...item, address: item.address.trim(), name: typeof item.name === 'string' ? item.name : '' }];
	});
}

function addressName(address) {
	return typeof address === 'string' && address.includes('@') ? address.slice(0, address.indexOf('@')) : '';
}

export function normalizeParsedEmail(parsed, envelopeFrom, envelopeTo) {
	const email = { ...parsed };
	const fromAddress = typeof parsed.from?.address === 'string' && parsed.from.address.trim()
		? parsed.from.address.trim()
		: (envelopeFrom || '');
	email.from = {
		address: fromAddress,
		name: typeof parsed.from?.name === 'string' ? parsed.from.name : ''
	};
	email.to = normalizeAddresses(parsed.to);
	if (!email.to.length) {
		email.to = [{ address: envelopeTo, name: addressName(envelopeTo) }];
	}
	email.cc = normalizeAddresses(parsed.cc);
	email.bcc = normalizeAddresses(parsed.bcc);
	email.attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
	for (const field of ['subject', 'html', 'text', 'inReplyTo', 'references', 'messageId']) {
		email[field] = typeof parsed[field] === 'string' ? parsed[field] : '';
	}
	return email;
}

export function recipientName(recipients, envelopeTo) {
	const address = envelopeTo.toLowerCase();
	return recipients.find(item => item.address.toLowerCase() === address)?.name || '';
}

export function checkBlock(blackSubject, blackContent, blackFrom, email) {
	if (splitEmailSetting(blackSubject).some(keyword => email.subject?.includes(keyword))) return true;
	if (splitEmailSetting(blackContent).some(keyword => email.html?.includes(keyword) || email.text?.includes(keyword))) return true;
	const address = (email.from?.address || '').toLowerCase();
	const domain = address.slice(address.lastIndexOf('@') + 1);
	return splitEmailSetting(blackFrom).some(item => {
		const entry = item.toLowerCase();
		return entry === address || (address.includes('@') && entry === domain);
	});
}
