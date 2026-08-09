/**
 * Standalone arrow-move invariants (no extensionless TS imports).
 * Run: node --experimental-strip-types ./src/lib/domain/workout.selfcheck.ts
 */
type Ex = { id: string; groupId: string | null };

function bounds(list: Ex[], index: number) {
	const item = list[index];
	if (!item?.groupId) return null;
	const groupId = item.groupId;
	let start = index;
	let end = index;
	while (start > 0 && list[start - 1]?.groupId === groupId) start -= 1;
	while (end < list.length - 1 && list[end + 1]?.groupId === groupId) end += 1;
	return { start, end, groupId };
}

function moveExercise(list: Ex[], fromIndex: number, toIndex: number): Ex[] {
	const exercises = [...list];
	const b = bounds(exercises, fromIndex);
	if (!b) {
		const [item] = exercises.splice(fromIndex, 1);
		exercises.splice(toIndex, 0, item!);
		return exercises;
	}
	const block = exercises.splice(b.start, b.end - b.start + 1);
	const insertAt = Math.min(
		Math.max(0, toIndex > fromIndex ? toIndex - (block.length - 1) : toIndex),
		exercises.length
	);
	exercises.splice(insertAt, 0, ...block);
	return exercises;
}

function moveWithinGroup(list: Ex[], fromIndex: number, toIndex: number): Ex[] {
	const b = bounds(list, fromIndex);
	if (!b || toIndex < b.start || toIndex > b.end) return list;
	const exercises = [...list];
	const [item] = exercises.splice(fromIndex, 1);
	exercises.splice(toIndex, 0, item!);
	return exercises;
}

function moveByArrow(list: Ex[], fromIndex: number, direction: -1 | 1): Ex[] {
	const n = list.length;
	const toIndex = fromIndex + direction;
	if (toIndex < 0 || toIndex >= n) return list;
	const b = bounds(list, fromIndex);
	if (b) {
		if (direction < 0 && fromIndex > b.start) return moveWithinGroup(list, fromIndex, fromIndex - 1);
		if (direction > 0 && fromIndex < b.end) return moveWithinGroup(list, fromIndex, fromIndex + 1);
		const dest = direction < 0 ? b.start - 1 : b.end + 1;
		if (dest < 0 || dest >= n) return list;
		return moveExercise(list, fromIndex, dest);
	}
	const nb = bounds(list, toIndex);
	if (nb) {
		const dest = direction < 0 ? nb.start : nb.end;
		return moveExercise(list, fromIndex, dest);
	}
	return moveExercise(list, fromIndex, toIndex);
}

function ids(list: Ex[]) {
	return list.map((e) => e.id).join();
}

const g = 'g1';
let list: Ex[] = [
	{ id: 'a', groupId: null },
	{ id: 'b', groupId: g },
	{ id: 'c', groupId: g },
	{ id: 'd', groupId: null }
];

list = moveByArrow(list, 2, -1);
if (ids(list) !== 'a,c,b,d') throw new Error(`within: ${ids(list)}`);

list = moveByArrow(list, 1, -1);
if (ids(list) !== 'c,b,a,d') throw new Error(`block: ${ids(list)}`);

list = moveByArrow(list, 3, -1);
if (ids(list) !== 'c,b,d,a') throw new Error(`solo: ${ids(list)}`);

list = moveByArrow(list, 2, -1);
if (ids(list) !== 'd,c,b,a') throw new Error(`jump: ${ids(list)}`);
if (list[1]!.groupId !== list[2]!.groupId) throw new Error('group broken');

console.log('workout moveByArrow self-check ok');
