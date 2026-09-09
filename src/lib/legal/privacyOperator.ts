/**
 * Operator details for /privacy and /terms.
 * REQUIRED before public production / store release — set all PUBLIC_PRIVACY_* in Vercel env.
 * Do not invent fake INN/address in the repo.
 */
const email = (import.meta.env.PUBLIC_PRIVACY_CONTACT_EMAIL as string | undefined)?.trim();
const name = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_NAME as string | undefined)?.trim();
const inn = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_INN as string | undefined)?.trim();
const address = (import.meta.env.PUBLIC_PRIVACY_OPERATOR_ADDRESS as string | undefined)?.trim();

export const PRIVACY_CONTACT_EMAIL = email || 'privacy@repdraft.app';

export function privacyPolicyVars(): Record<string, string> {
	const parts: string[] = [];
	if (name) parts.push(name);
	if (inn) parts.push(`ИНН ${inn}`);
	if (address) parts.push(address);
	const operator = parts.length > 0 ? parts.join(', ') : 'Repdraft';
	return {
		operator,
		email: PRIVACY_CONTACT_EMAIL
	};
}
