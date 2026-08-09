/** Reject if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error('errors.timeout')), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(err) => {
				clearTimeout(t);
				reject(err);
			}
		);
	});
}
