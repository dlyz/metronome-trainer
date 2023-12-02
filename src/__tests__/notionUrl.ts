import { getNotionPageIdFromUrl } from "../Notion/notionUrl";


test("notion page id from url", () => {
	expect(getNotionPageIdFromUrl("https://www.notion.so/1-28400ef2f94c47fdb3d54142b137ce9b")).toBe("28400ef2f94c47fdb3d54142b137ce9b");
	expect(getNotionPageIdFromUrl("https://www.notion.so/dlyz/Templates-252692a4825c4e9eac41538ae74fcfb2")).toBe("252692a4825c4e9eac41538ae74fcfb2");
	expect(getNotionPageIdFromUrl("https://www.notion.so/dlyz/Templates-252692a4825c4e9eac41538ae74fcfb")).toBe(undefined);
	expect(getNotionPageIdFromUrl("https://www.notion.so/dlyz/Templates-252692a4825c4e9eac41538ae74fcfb21")).toBe(undefined);
	expect(getNotionPageIdFromUrl("https://www.notion.so/dlyz/Templates-252692a4825c4e9eac41538ae74fcfbg")).toBe(undefined);
});
