import { DatabaseSync } from 'node:sqlite';

// Run Drizzle's real SQL against SQLite using the subset of D1 used by these tests.
export function createTestD1(schema) {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec(schema);
	function prepare(sql, params = []) {
		const statement = sqlite.prepare(sql);
		return {
			bind(...values) { return prepare(sql, values); },
			async raw() { return statement.all(...params).map(row => Object.values(row)); },
			async all() { return { results: statement.all(...params), success: true }; },
			async first(column) {
				const row = statement.get(...params);
				return column ? row?.[column] ?? null : row ?? null;
			},
			async run() {
				const result = statement.run(...params);
				return { success: true, meta: { changes: Number(result.changes) } };
			},
		};
	}
	return { sqlite, prepare, close: () => sqlite.close() };
}
