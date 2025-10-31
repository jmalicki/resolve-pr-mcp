import { describe, it, expect } from "vitest";
import {
  applyCodeRabbitFiltering,
  shouldFilterCodeRabbitIssueComment,
} from "../../../../src/tools/find-unresolved-comments/lib/coderabbit";
import type { Comment } from "../../../../src/tools/find-unresolved-comments/schema";

function makeComment(
  type: "actionable" | "nit" | "duplicate" | "additional",
  overrides: Partial<Comment> = {},
): Comment {
  const base: Comment = {
    id: Math.floor(Math.random() * 1000000),
    type: "review",
    author: "coderabbitai",
    author_association: "NONE",
    is_bot: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_path: "src/file.rs",
    line_number: 10,
    body: "Test body",
    action_commands: {
      reply_command: "",
      resolve_condition: "",
      view_in_browser: "",
    },
    coderabbit_metadata: {
      suggestion_type: type,
      severity: type === "actionable" ? "high" : "low",
      category: "general",
      file_context: {
        path: "src/file.rs",
        line_start: 10,
        line_end: 12,
      },
      code_suggestion: null,
      agent_prompt: "",
      implementation_guidance: {
        priority: "low",
        effort_estimate: "",
        rationale: "",
      },
    },
    status_indicators: {
      needs_mcp_resolution: false,
      has_manual_response: false,
      is_actionable: type === "actionable",
      is_outdated: false,
      priority_score: type === "actionable" ? 50 : 10,
      resolution_status: "unresolved",
      suggested_action: "reply",
    },
  };
  return { ...base, ...overrides };
}

describe("applyCodeRabbitFiltering", () => {
  it("keeps all comments by default when includes are not disabled", () => {
    const comments: Comment[] = [
      makeComment("actionable"),
      makeComment("nit"),
      makeComment("duplicate"),
      makeComment("additional"),
    ];

    const filtered = applyCodeRabbitFiltering(comments, {
      include_nits: true,
      include_duplicates: true,
      include_additional: true,
      prioritize_actionable: false,
    });

    expect(filtered.length).toBe(4);
  });

  it("drops nits when include_nits is false", () => {
    const comments: Comment[] = [makeComment("actionable"), makeComment("nit")];

    const filtered = applyCodeRabbitFiltering(comments, {
      include_nits: false,
      include_duplicates: true,
      include_additional: true,
      prioritize_actionable: false,
    });

    expect(filtered.map((c) => c.coderabbit_metadata!.suggestion_type)).toEqual(
      ["actionable"],
    );
  });

  it("always includes actionable items even when suggestion_types excludes others", () => {
    const comments: Comment[] = [
      makeComment("actionable"),
      makeComment("nit"),
      makeComment("duplicate"),
    ];

    const filtered = applyCodeRabbitFiltering(comments, {
      include_nits: true,
      include_duplicates: true,
      include_additional: true,
      suggestion_types: ["actionable"],
      prioritize_actionable: true,
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].coderabbit_metadata!.suggestion_type).toBe("actionable");
  });
});
