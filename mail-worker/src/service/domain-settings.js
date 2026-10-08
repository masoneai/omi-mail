// Accept both TOML arrays and JSON strings without changing the deployment format.
export function normalizeDomains(value) {
	if (value == null || (typeof value === 'string' && !value.trim())) {
		throw new Error('noDomainVariable');
	}

	let domains = value;
	if (typeof domains === 'string') {
		try {
			domains = JSON.parse(domains);
		} catch {
			throw new Error('notJsonDomain');
		}
	}

	if (!Array.isArray(domains)) {
		throw new Error('notJsonDomain');
	}
	if (!domains.length) {
		throw new Error('noDomainVariable');
	}
	if (domains.some(domain => typeof domain !== 'string' || !domain.trim())) {
		throw new Error('notJsonDomain');
	}

	return [...new Set(domains.map(domain => domain.trim().toLowerCase()))];
}

export function applySettingsEnvironment(settings, env, domains = normalizeDomains(env.domain)) {
	settings.domainList = domains.map(domain => '@' + domain);
	settings.projectLink = env.project_link !== false && env.project_link !== 'false';
	settings.emailPrefixFilter = Array.isArray(settings.emailPrefixFilter)
		? [...settings.emailPrefixFilter]
		: (settings.emailPrefixFilter || '').split(',').filter(Boolean);
	return settings;
}
