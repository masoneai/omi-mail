import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMaintenance } from '../src/lib/maintenance';
import worker from '../src/index';
import verifyRecordService from '../src/service/verify-record-service';
import userService from '../src/service/user-service';
import emailService from '../src/service/email-service';
import analysisService from '../src/service/analysis-service';
import oauthService from '../src/service/oauth-service';
import { createTestD1 } from './helpers/d1';

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('scheduled maintenance', () => {
	it('attempts every task in order and exposes failures to the runtime', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const completed = [];
		await expect(runMaintenance([
			['one', async () => { completed.push(1); throw new Error('D1 unavailable'); }],
			['two', async () => { completed.push(2); }],
			['three', async () => { completed.push(3); throw new Error('KV unavailable'); }],
		])).rejects.toMatchObject({ errors: [expect.any(Error), expect.any(Error)] });
		expect(completed).toEqual([1, 2, 3]);
	});

	it('passes the scheduled timestamp, even if a midnight trigger executes late', async () => {
		const scheduledTime = Date.parse('2026-10-07T00:00:00Z');
		const verification = vi.spyOn(verifyRecordService, 'clearRecord').mockResolvedValue();
		const quotas = vi.spyOn(userService, 'resetDaySendCount').mockResolvedValue();
		vi.spyOn(emailService, 'completeReceiveAll').mockResolvedValue();
		vi.spyOn(emailService, 'autoClean').mockResolvedValue();
		vi.spyOn(analysisService, 'refreshEchartsCache').mockResolvedValue();
		vi.spyOn(oauthService, 'clearNoBindOathUser').mockResolvedValue();
		await worker.scheduled({ cron: '0 * * * *', scheduledTime }, {}, {});
		expect(verification).toHaveBeenCalledWith({ env: {} }, scheduledTime);
		expect(quotas).toHaveBeenCalledWith({ env: {} }, scheduledTime);
	});

	it('clears verification records for the scheduled midnight after the clock passes 01:00', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-07T01:15:00Z'));
		const db = createTestD1('CREATE TABLE verify_record (vr_id INTEGER PRIMARY KEY); INSERT INTO verify_record VALUES (1);');
		try {
			await verifyRecordService.clearRecord({ env: { db } }, Date.parse('2026-10-07T00:00:00Z'));
			expect(db.sqlite.prepare('SELECT count(*) AS count FROM verify_record').get().count).toBe(0);
		} finally {
			db.close();
		}
	});
});
