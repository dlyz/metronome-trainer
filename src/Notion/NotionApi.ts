import { Client } from "@notionhq/client";
import type {
	BlockObjectResponse,
	DatabaseObjectResponse,
	GetDatabaseResponse,
	PageObjectResponse,
	PartialBlockObjectResponse,
	PartialDatabaseObjectResponse,
	PartialPageObjectResponse,
	QueryDatabaseParameters
} from "@notionhq/client/build/src/api-endpoints";

export  {
	PageObjectResponse,
	DatabaseObjectResponse,
	BlockObjectResponse
}

export type DatabaseItem = PageObjectResponse | DatabaseObjectResponse;

export class NotionApi {

	static getPageIdFromUrl(url: string | undefined) {
		// https://www.notion.so/1-28400ef2f94c47fdb3d54142b137ce9b
		if (!url) return undefined;
		if (!url.startsWith("https://www.notion.so/")) return undefined;

		const parts = url.split('/');
		if (parts.length !== 4) return undefined;
		const pagePart = parts[3];
		const idStart = pagePart.lastIndexOf('-');

		if (idStart === -1) return undefined;

		let idEnd = pagePart.indexOf('?');
		if (idEnd === -1) {
			idEnd = pagePart.indexOf('#');
		}

		if (idEnd === -1) {
			idEnd = pagePart.length;
		}

		return pagePart.substring(idStart + 1, idEnd);
	}

	#client: Client = undefined!;

	get client() { return this.#client; }

	updateClient(options: { token?: string }) {
		this.#client = new Client({ auth: options.token });
	}

	constructor(options: { token?: string }) {
		this.updateClient(options);
	}

	getBlockChildren(blockId: string): PageProvider<BlockObjectResponse> {
		return usePagination(startCursor => this.client.blocks.children.list({
			block_id: blockId,
			start_cursor: startCursor,
		})) as PageProvider<BlockObjectResponse>;
	}

	queryDatabase(options: QueryDatabaseParameters): PageProvider<DatabaseItem> {
		return usePagination(startCursor => this.client.databases.query({
			...options,
			start_cursor: startCursor,
		})) as PageProvider<DatabaseItem>;
	}

}

type PageProvider<T> = () => PromiseLike<T[] | undefined> | undefined;



export function usePagination<T>(requester: (startCursor?: string) => Promise<ListResponse<T>>): PageProvider<T> {

	let cursor: string | undefined | null;
	return () => {
		if (cursor === null) return undefined;
		return next(cursor);
	}

	async function next(currentCursor: string | undefined) {
		const response = await requester(currentCursor);
		cursor = response.has_more ? response.next_cursor : null;
		return response.results;
	}
}


export async function getAllPages<T>(provider: PageProvider<T>) {
	const result = [];
	let page: T[] | undefined;
	while(page = await provider()) {
		result.push(...page);
	}
	return result;
}


export type DateTime = string;

export interface ListResponse<T> {
	"object": "list";
	"results": T[];
	"next_cursor": string | null;
	"has_more": boolean;
}


