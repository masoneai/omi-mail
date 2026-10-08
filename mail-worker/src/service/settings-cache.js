export const SETTINGS_CACHE_TTL_MS = 30_000;

export function cloneSettings(value) {
	return value == null ? value : structuredClone(value);
}

// Cache completed values only: Workers must not reuse another request's I/O promise.
// Binding identity separates namespaces, while WeakMap lets retired bindings be collected.
export function createSettingsCache({ now = Date.now } = {}) {
	const entries = new WeakMap();

	return {
		async get(binding, read) {
			let entry = entries.get(binding);
			if (entry?.value != null && entry.expiresAt > now()) {
				return cloneSettings(entry.value);
			}

			if (!entry) {
				entry = {};
				entries.set(binding, entry);
			}

			const value = await read();
			// An invalidation or refresh supersedes reads started before it.
			if (value != null && entries.get(binding) === entry) {
				entry.value = cloneSettings(value);
				entry.expiresAt = now() + SETTINGS_CACHE_TTL_MS;
			}
			return cloneSettings(value);
		},

		set(binding, value) {
			entries.set(binding, {
				value: cloneSettings(value),
				expiresAt: now() + SETTINGS_CACHE_TTL_MS
			});
		},

		invalidate(binding) {
			entries.delete(binding);
		}
	};
}
