export function supportsAgentBrowserVersion(output) {
	const match = /(?:^|\s)v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?(?:\s|$)/u.exec(output.trim());
	if (!match || match[4] !== undefined) return false;
	const actual = match.slice(1, 4).map(Number);
	const minimum = [0, 38, 1];
	for (let index = 0; index < minimum.length; index += 1) {
		const difference = (actual[index] ?? 0) - (minimum[index] ?? 0);
		if (difference !== 0) return difference > 0;
	}
	return true;
}
