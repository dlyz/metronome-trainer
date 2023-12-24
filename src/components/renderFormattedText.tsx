import React from "react";
import { FormattedText, FormattedTextBlock, FormattedTextInline, FormattedTextLink } from "../models/FormattedText";

export interface FormattedTextRenderContext {
	renderLink?: (key: number, link: FormattedTextLink) => JSX.Element | undefined;
}

export function renderFormattedText(text: FormattedText, context?: FormattedTextRenderContext) {
	return text.map((block, i) => renderFormattedTextBlock(i, block, context));
}

export function renderFormattedTextBlock(key: number, block: FormattedTextBlock, context?: FormattedTextRenderContext) {
	const children = block.content.map((inline, i) => renderFormattedTextInline(i, inline, context));

	return <p key={key}>{children}</p>
}

export function renderFormattedTextInline(key: number, inline: FormattedTextInline, context?: FormattedTextRenderContext) {
	switch (inline.type) {
		case "link": {
			const result = context?.renderLink?.(key, inline);
			if (result !== undefined) return result;
			return (
				<a key={key} href={inline.link} {...(inline.external ? { target: "_blank", rel: "noopener noreferrer"  } : {})}>
					{inline.text}
				</a>
			);
		}
		default: return (
			<span key={key}>{inline.text}</span>
		);
	}
}
