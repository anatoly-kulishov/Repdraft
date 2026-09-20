import { env as privateEnv } from '$env/dynamic/private';

export type AiProvider = 'gigachat' | 'ollama';

export type AiConfig = {
	provider: AiProvider;
	baseUrl: string;
	model: string;
	apiKey: string;
	oauthUrl: string;
	scope: string;
	sslVerify: boolean;
};

function trim(v: string | undefined): string {
	return (v ?? '').trim();
}

/** Private env dual profile (GigaChat RF / Ollama local). */
export function resolveAiConfig(): AiConfig | null {
	const raw = trim(privateEnv.AI_PROVIDER || privateEnv.LLM_PROVIDER).toLowerCase() || 'gigachat';
	const provider: AiProvider = raw === 'ollama' ? 'ollama' : 'gigachat';

	if (provider === 'ollama') {
		const baseUrl = (
			trim(privateEnv.OLLAMA_BASE_URL) || 'http://127.0.0.1:11434/v1'
		).replace(/\/$/, '');
		return {
			provider,
			baseUrl,
			model: trim(privateEnv.OLLAMA_MODEL) || 'qwen2.5:3b',
			apiKey: trim(privateEnv.OLLAMA_API_KEY) || 'ollama',
			oauthUrl: '',
			scope: '',
			sslVerify: true
		};
	}

	const apiKey = trim(privateEnv.GIGACHAT_API_KEY || privateEnv.LLM_API_KEY).replace(/^sk-/, '');
	if (!apiKey) return null;

	return {
		provider: 'gigachat',
		baseUrl: (trim(privateEnv.GIGACHAT_BASE_URL) || 'https://api.giga.chat/v1').replace(
			/\/$/,
			''
		),
		model: trim(privateEnv.GIGACHAT_MODEL) || 'GigaChat-2',
		apiKey,
		oauthUrl:
			trim(privateEnv.GIGACHAT_OAUTH_URL) ||
			'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
		scope: trim(privateEnv.GIGACHAT_SCOPE) || 'GIGACHAT_API_PERS',
		sslVerify: /^(1|true|yes)$/i.test(trim(privateEnv.GIGACHAT_SSL_VERIFY) || 'false')
	};
}

export function aiAvailability(): {
	available: boolean;
	provider: AiProvider | null;
	reason: string | null;
} {
	const cfg = resolveAiConfig();
	if (!cfg) {
		return {
			available: false,
			provider: null,
			reason: 'missing_credentials'
		};
	}
	return { available: true, provider: cfg.provider, reason: null };
}
