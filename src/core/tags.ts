export function normalizeTags(value: string): string[] | null {
	const tags = value
		.split(",")
		.map((tag) =>
			tag
				.trim()
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^\p{L}\p{N}-]/gu, "")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, ""),
		)
		.filter((tag) => tag.length >= 2 && tag.length <= 40)
		.filter((tag, index, all) => all.indexOf(tag) === index)
		.slice(0, 7);

	return tags.length > 0 ? tags : null;
}
