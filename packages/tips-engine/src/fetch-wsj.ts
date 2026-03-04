export function parseWSJHtml(html: string): WSJBond[] {
    const dataRegex = /"instruments":(\[.*?\])/s;
    const match = html.match(dataRegex);	if (!match) return [];

	try {
		return JSON.parse(match[1]);
	} catch (e) {
		console.error("Failed to parse WSJ JSON", e);
		return [];
	}
}

export async function fetchTipsFromWSJ(): Promise<WSJBond[]> {
	const url = "https://www.wsj.com/market-data/bonds/tips";
	const headers = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	};

	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`WSJ fetch failed: ${response.status}`);
	}

	const html = await response.text();
	return parseWSJHtml(html);
}

if (import.meta.main) {
	fetchTipsFromWSJ()
		.then((bonds) => {
			console.log(`Successfully parsed ${bonds.length} TIPS bonds from WSJ.`);
			if (bonds.length > 0) {
				console.log("Sample:", bonds[0]);
			}
		})
		.catch(console.error);
}
