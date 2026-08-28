/** Routes that display Gym Visual exercise thumbnails or GIFs. */
export function showsExerciseMediaAttribution(pathname: string): boolean {
	return (
		pathname === '/exercises' ||
		pathname.startsWith('/exercises/') ||
		pathname.startsWith('/catalog') ||
		pathname.startsWith('/exercise/')
	);
}
