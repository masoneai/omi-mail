// Preserve task order, but one failure must not skip unrelated maintenance.
export async function runMaintenance(tasks) {
	const failures = [];
	for (const [name, task] of tasks) {
		try {
			await task();
		} catch (error) {
			console.error(`Maintenance task failed: ${name}`, error);
			failures.push(error);
		}
	}
	if (failures.length) throw new AggregateError(failures, 'Maintenance tasks failed');
}
