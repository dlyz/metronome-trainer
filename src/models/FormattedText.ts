
export type FormattedText = FormattedTextBlock[];

export type FormattedTextBlock = {
	type: "p",
	content: FormattedTextInline[],
};

export type FormattedTextInline = FormattedTextSpan | FormattedTextLink;

export interface FormattedTextSpan {
	type: "span",
	text: string,
}

export interface FormattedTextLink {
	type: "link",
	text: string,
	link: string,
	external?: boolean,
}

export function fblock(
	strings: TemplateStringsArray,
	...args: FormattedTextInline[]
): FormattedTextBlock {
	return { type: "p", content: fblockContent(strings, ...args), }
}

export function fblockContent(
	strings: TemplateStringsArray,
	...args: FormattedTextInline[]
) {
	const items: FormattedTextInline[] = [];

	if (strings[0].length) {
		items.push(fspan(strings[0]));
	}

	for (let i = 0; i < args.length; i++) {
		items.push(args[i]);

		if (strings[i + 1].length) {
			items.push(fspan(strings[i + 1]));
		}
	}

	return items;
}

export function fspan(text: string): FormattedTextSpan {
	return { type: "span", text };
}

export function flink(text: string, link: string, props?: Omit<FormattedTextLink, "type" | "text" | "link">): FormattedTextLink {
	return { type: "link", text, link, ...props };
}
