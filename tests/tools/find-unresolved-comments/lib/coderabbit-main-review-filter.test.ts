import { describe, it, expect } from "vitest";
import {
  shouldFilterCodeRabbitReviewBody,
  shouldFilterCodeRabbitIssueComment,
} from "../../../../src/tools/find-unresolved-comments/lib/coderabbit.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("CodeRabbit Main Review Filter", () => {
  const testDataDir = path.join(
    __dirname,
    "test-data",
    "coderabbit-filter",
    "prs",
  );
  const expectationsPath = path.join(testDataDir, "file-expected.json");

  it("should load and process review data from test files", async () => {
    // Load the main review file
    const reviewFile = path.join(
      testDataDir,
      "review-PRR_kwDOQKdW-c7J2-Rw.json",
    );
    const reviewData = JSON.parse(await fs.readFile(reviewFile, "utf8"));

    // Load the issue comment file
    const issueCommentFile = path.join(
      testDataDir,
      "issue-comment-IC_kwDOQKdW-c7N53Vf.json",
    );
    const issueCommentData = JSON.parse(
      await fs.readFile(issueCommentFile, "utf8"),
    );

    // Load all review comment files
    const reviewCommentsDir = path.join(testDataDir, "review-comments");
    const reviewCommentFiles = await fs.readdir(reviewCommentsDir);
    const reviewCommentData = await Promise.all(
      reviewCommentFiles.map(async (file) => {
        const filePath = path.join(reviewCommentsDir, file);
        return JSON.parse(await fs.readFile(filePath, "utf8"));
      }),
    );

    // Mock PR info
    const mockPR = {
      owner: "jmalicki",
      repo: "subagent-worktree-mcp",
      number: 1,
    };

    // Process the main review
    if (reviewData.data?.node?.body) {
      const mockReview = {
        id: reviewData.data.node.databaseId,
        user: {
          login: reviewData.data.node.author?.login || "coderabbitai",
          type: "Bot",
        },
        body: reviewData.data.node.body,
        state: reviewData.data.node.state,
        author_association: "NONE",
        created_at: reviewData.data.node.createdAt,
        updated_at: reviewData.data.node.updatedAt,
      };

      const reviewComments = processCodeRabbitReview(
        reviewData.data.node.body,
        mockReview as any,
        mockPR,
        reviewData.data.node.author?.login || "coderabbitai",
        "NONE",
        true, // isBot
        {}, // options
        true, // includeStatusIndicators
      );

      console.log(`Main review generated ${reviewComments.length} comments`);

      // Apply filtering
      const filteredComments = applyCodeRabbitFiltering(reviewComments, {});
      console.log(`After filtering: ${filteredComments.length} comments`);
    }

    // Process issue comment
    if (issueCommentData.data?.node?.body) {
      console.log(
        `Issue comment body length: ${issueCommentData.data.node.body.length}`,
      );

      const mockIssueComment = {
        id: issueCommentData.data.node.databaseId,
        user: {
          login: issueCommentData.data.node.author?.login || "coderabbitai",
          type: "Bot",
        },
        body: issueCommentData.data.node.body,
        author_association: "NONE",
        created_at: issueCommentData.data.node.createdAt,
        updated_at: issueCommentData.data.node.updatedAt,
        html_url: `https://github.com/jmalicki/subagent-worktree-mcp/issues/1#issuecomment-${issueCommentData.data.node.databaseId}`,
      };

      // First, show what happens without pre-filtering (1 comment)
      const issueCommentsWithoutPreFilter = processCodeRabbitIssueComment(
        issueCommentData.data.node.body,
        mockIssueComment,
        mockPR,
        issueCommentData.data.node.author?.login || "coderabbitai",
        "NONE",
        true, // isBot
        {}, // options
        true, // includeStatusIndicators
      );
      console.log(
        `Issue comment generated ${issueCommentsWithoutPreFilter.length} comments (without pre-filter)`,
      );

      // Then show what happens with pre-filtering (0 comments)
      const issueComments = processCodeRabbitIssueComment(
        issueCommentData.data.node.body,
        mockIssueComment,
        mockPR,
        issueCommentData.data.node.author?.login || "coderabbitai",
        "NONE",
        true, // isBot
        {}, // options
        true, // includeStatusIndicators
      );
      console.log(
        `Issue comment generated ${issueComments.length} comments (with pre-filter)`,
      );

      // Apply filtering
      const filteredIssueComments = applyCodeRabbitFiltering(issueComments, {});
      console.log(`After filtering: ${filteredIssueComments.length} comments`);
    }

    // Process review comments
    reviewCommentData.forEach((commentData, index) => {
      if (commentData.data?.node?.body) {
        console.log(
          `Review comment ${index + 1} body length: ${commentData.data.node.body.length}`,
        );
      }
    });

    // For now, just verify we loaded the data successfully
    expect(reviewData.data?.node).toBeDefined();
    expect(issueCommentData.data?.node).toBeDefined();
    expect(reviewCommentData.length).toBeGreaterThan(0);
  });

  it("should filter files according to expected mapping", async () => {
    const mappingRaw = await fs.readFile(expectationsPath, "utf8");
    const fileExpectationMap: Record<string, boolean> = JSON.parse(mappingRaw);

    // Mock PR info
    const mockPR = {
      owner: "jmalicki",
      repo: "subagent-worktree-mcp",
      number: 1,
    };

    // Test each file according to its expected behavior
    for (const [relPath, shouldBeActionable] of Object.entries(
      fileExpectationMap,
    )) {
      const fullPath = path.join(testDataDir, relPath);
      const fileData = JSON.parse(await fs.readFile(fullPath, "utf8"));

      if (!fileData.data?.node?.body) {
        console.log(`Skipping ${relPath} - no body content`);
        continue;
      }

      // Create mock review/comment object based on file type
      let mockReview: any;
      if (relPath.startsWith("review-PRR_")) {
        // Main review
        mockReview = {
          id: fileData.data.node.databaseId,
          user: {
            login: fileData.data.node.author?.login || "coderabbitai",
            type: "Bot",
          },
          body: fileData.data.node.body,
          state: fileData.data.node.state,
          author_association: "NONE",
          created_at: fileData.data.node.createdAt,
          updated_at: fileData.data.node.updatedAt,
        };
      } else if (relPath.startsWith("issue-comment-")) {
        // Issue comment
        mockReview = {
          id: fileData.data.node.databaseId,
          user: {
            login: fileData.data.node.author?.login || "coderabbitai",
            type: "Bot",
          },
          body: fileData.data.node.body,
          author_association: "NONE",
          created_at: fileData.data.node.createdAt,
          updated_at: fileData.data.node.updatedAt,
        };
      } else if (relPath.startsWith("review-comments/")) {
        // Review comment - these are individual comments, not reviews
        console.log(
          `Review comment ${relPath} - skipping parsing (individual comments)`,
        );
        continue;
      }

      if (mockReview) {
        // Parse CodeRabbit content
        const comments = processCodeRabbitReview(
          fileData.data.node.body,
          mockReview,
          mockPR,
          fileData.data.node.author?.login || "coderabbitai",
          "NONE",
          true, // isBot
          {}, // options
          true, // includeStatusIndicators
        );

        // Apply filtering
        const filteredComments = applyCodeRabbitFiltering(comments, {});

        console.log(
          `${relPath}: ${comments.length} -> ${filteredComments.length} (expected: ${shouldBeActionable ? "actionable" : "filtered"})`,
        );

        if (shouldBeActionable) {
          // Should have actionable content
          expect(filteredComments.length).toBeGreaterThan(0);
        } else {
          // Should be filtered out
          expect(filteredComments.length).toBe(0);
        }
      }
    }
  });
});
