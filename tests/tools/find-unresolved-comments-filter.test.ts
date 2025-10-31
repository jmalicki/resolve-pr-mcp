import { describe, it, expect } from "vitest";
import { filterUnresolvedComments } from "../../src/tools/find-unresolved-comments/lib/filtering.js";
import { shouldFilterCodeRabbitIssueComment } from "../../src/tools/find-unresolved-comments/lib/coderabbit.js";
import type { Comment } from "../../src/tools/find-unresolved-comments/schema.js";

describe("filterUnresolvedComments", () => {
  const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
    id: 1,
    type: "review_comment",
    author: "test-user",
    author_association: "CONTRIBUTOR",
    is_bot: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    body: "Test comment",
    reactions: {
      total_count: 0,
      "+1": 0,
      "-1": 0,
      laugh: 0,
      hooray: 0,
      confused: 0,
      heart: 0,
      rocket: 0,
      eyes: 0,
    },
    html_url: "https://github.com/test/repo/pull/1#discussion_r1",
    action_commands: {
      reply_command:
        'gh pr comment 1 --repo test/repo --body "YOUR_RESPONSE_HERE"',
      resolve_command: 'gh pr comment 1 --repo test/repo --body "✅ Fixed"',
      resolve_condition: "Run ONLY after you've verified the fix",
      view_in_browser: "gh pr view 1 --repo test/repo --web",
    },
    ...overrides,
  });

  it("should include original comments without in_reply_to_id", () => {
    const comments = [
      createMockComment({ id: 1, in_reply_to_id: undefined }),
      createMockComment({ id: 2, in_reply_to_id: undefined }),
    ];
    const nodeIdMap = new Map<number, string>();
    const resolvedThreadIds = new Set<string>();

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(2);
  });

  it("should exclude reply comments with in_reply_to_id", () => {
    const comments = [
      createMockComment({ id: 1, in_reply_to_id: undefined }), // Original comment
      createMockComment({ id: 2, in_reply_to_id: 1 }), // Reply to comment 1
      createMockComment({ id: 3, in_reply_to_id: undefined }), // Another original comment
    ];
    const nodeIdMap = new Map<number, string>();
    const resolvedThreadIds = new Set<string>();

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[1].id).toBe(3);
    expect(result.find((c) => c.id === 2)).toBeUndefined();
  });

  it("should exclude comments from resolved threads", () => {
    const comments = [
      createMockComment({
        id: 1,
        type: "review_comment",
        in_reply_to_id: undefined,
      }),
      createMockComment({
        id: 2,
        type: "review_comment",
        in_reply_to_id: undefined,
      }),
    ];
    const nodeIdMap = new Map<number, string>([
      [1, "thread-1"],
      [2, "thread-2"],
    ]);
    const resolvedThreadIds = new Set<string>(["thread-1"]);

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
    expect(result.find((c) => c.id === 1)).toBeUndefined();
  });

  it("should exclude issue comments that are replies (defensive handling)", () => {
    // Note: GitHub REST API for issue comments doesn't expose in_reply_to_id,
    // but this test covers defensive handling of synthetic edge cases
    const comments = [
      createMockComment({
        id: 1,
        type: "issue_comment",
        in_reply_to_id: undefined, // Original issue comment
      }),
      createMockComment({
        id: 2,
        type: "issue_comment",
        in_reply_to_id: 1, // Synthetic reply to issue comment - should be excluded
      }),
    ];
    const nodeIdMap = new Map<number, string>();
    const resolvedThreadIds = new Set<string>();

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result.find((c) => c.id === 2)).toBeUndefined();
  });

  it("should handle mixed comment types correctly", () => {
    const comments = [
      createMockComment({
        id: 1,
        type: "review_comment",
        in_reply_to_id: undefined,
      }), // Original review comment
      createMockComment({ id: 2, type: "review_comment", in_reply_to_id: 1 }), // Reply to review comment
      createMockComment({
        id: 3,
        type: "issue_comment",
        in_reply_to_id: undefined,
      }), // Original issue comment
      createMockComment({ id: 4, type: "issue_comment", in_reply_to_id: 3 }), // Reply to issue comment
    ];
    const nodeIdMap = new Map<number, string>([
      [1, "thread-1"],
      [2, "thread-1"],
    ]);
    const resolvedThreadIds = new Set<string>();

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1); // Original review comment
    expect(result[1].id).toBe(3); // Original issue comment
    expect(result.find((c) => c.id === 2)).toBeUndefined(); // Reply to review comment excluded
    expect(result.find((c) => c.id === 4)).toBeUndefined(); // Reply to issue comment excluded
  });

  it("should handle empty input", () => {
    const comments: Comment[] = [];
    const nodeIdMap = new Map<number, string>();
    const resolvedThreadIds = new Set<string>();

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(0);
  });

  it("should handle comments without thread mapping", () => {
    const comments = [
      createMockComment({
        id: 1,
        type: "review_comment",
        in_reply_to_id: undefined,
      }),
    ];
    const nodeIdMap = new Map<number, string>(); // Empty map
    const resolvedThreadIds = new Set<string>(["thread-1"]);

    const result = filterUnresolvedComments(
      comments,
      nodeIdMap,
      resolvedThreadIds,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
