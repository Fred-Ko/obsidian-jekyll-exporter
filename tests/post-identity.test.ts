import { describe, expect, it } from "vitest";
import { reconcilePostId } from "../src/core/post-identity";

const FIRST_ID = "836c2a09-9c9b-56b4-a6cb-a7d0d9e4c001";
const SECOND_ID = "1aadc485-bb8b-58bd-a950-b288021a5872";

describe("reconcilePostId", () => {
	it("creates an ID once when neither side has one", () => {
		const source = {};
		expect(reconcilePostId(source, undefined, () => FIRST_ID)).toBe(FIRST_ID);
		expect(source).toEqual({ post_id: FIRST_ID });
	});

	it("keeps the source ID", () => {
		const source = { post_id: FIRST_ID };
		expect(reconcilePostId(source)).toBe(FIRST_ID);
	});

	it("restores the published ID into the source", () => {
		const source = {};
		expect(reconcilePostId(source, { post_id: FIRST_ID })).toBe(FIRST_ID);
		expect(source).toEqual({ post_id: FIRST_ID });
	});

	it("accepts matching IDs", () => {
		expect(reconcilePostId({ post_id: FIRST_ID }, { post_id: FIRST_ID })).toBe(FIRST_ID);
	});

	it("normalizes UUID casing", () => {
		expect(reconcilePostId({ post_id: FIRST_ID.toUpperCase() })).toBe(FIRST_ID);
	});

	it("rejects conflicts", () => {
		expect(() => reconcilePostId({ post_id: FIRST_ID }, { post_id: SECOND_ID })).toThrow(
			/post_id가 다릅니다/,
		);
	});

	it("rejects malformed IDs", () => {
		expect(() => reconcilePostId({ post_id: "not-a-uuid" })).toThrow(/유효한 UUID/);
	});
});
