import { describe, it, expect } from "vitest";
import {
  shouldFilterCodeRabbitReviewBody,
  shouldFilterCodeRabbitIssueComment,
} from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";

describe("CodeRabbit Pre-filtering", () => {
  it("should filter out rate limit messages", () => {
    const rateLimitBody =
      "I've reached my rate limit for this repository. Please try again later.";
    expect(shouldFilterCodeRabbitReviewBody(rateLimitBody)).toBe(true);
  });

  it("should filter out internal state messages", () => {
    const internalStateBody = "Internal state: processing...";
    expect(shouldFilterCodeRabbitReviewBody(internalStateBody)).toBe(true);
  });

  it("should allow normal review bodies", () => {
    const normalBody = `
## 🔍 CodeRabbit Review

### 🐛 Bugs
- **src/file.rs:10-15**: Fix potential null pointer
`;
    expect(shouldFilterCodeRabbitReviewBody(normalBody)).toBe(false);
  });

  it("should allow empty review bodies", () => {
    expect(shouldFilterCodeRabbitReviewBody("")).toBe(false);
  });

  it("should handle various rate limit message formats", () => {
    const variations = [
      "I've reached my rate limit for this repository",
      "Rate limit exceeded",
      "Please try again later due to rate limiting",
      "Rate limit reached for this repository",
    ];

    variations.forEach((body) => {
      expect(shouldFilterCodeRabbitReviewBody(body)).toBe(true);
    });
  });

  it("should handle various internal state message formats", () => {
    const variations = [
      "Internal state: processing",
      "Internal state: analyzing",
      "Processing your request",
      "Analyzing code changes",
    ];

    variations.forEach((body) => {
      expect(shouldFilterCodeRabbitReviewBody(body)).toBe(true);
    });
  });
});
