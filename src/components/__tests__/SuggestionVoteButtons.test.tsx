// @vitest-environment jsdom
import { describe, it, expect, vi } from"vitest";
import { render, screen, fireEvent } from"@testing-library/react";
import SuggestionVoteButtons from"@/components/SuggestionVoteButtons";

// Mock server actions
vi.mock("@/app/actions/catalog-suggestions", () => ({
 voteSuggestion: vi.fn().mockResolvedValue({ success: true }),
 removeVote: vi.fn().mockResolvedValue({ success: true }),
}));

describe("SuggestionVoteButtons", () => {
 it("renders upvote, downvote, and net score", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote={null} upvotes={5} downvotes={2} />);

 expect(screen.getByText("▲")).toBeDefined();
 expect(screen.getByText("▼")).toBeDefined();
 expect(screen.getByText("3")).toBeDefined(); // net score = 5 - 2
 });

 it("highlights active upvote", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote="up" upvotes={5} downvotes={2} />);

 const upBtn = screen.getByTitle(/^Upvote/);
 expect(upBtn.className).toContain("ref-vote-active");
 });

 it("highlights active downvote", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote="down" upvotes={5} downvotes={2} />);

 const downBtn = screen.getByTitle(/^Downvote/);
 expect(downBtn.className).toContain("ref-vote-active");
 });

 it("optimistically updates score on upvote click", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote={null} upvotes={5} downvotes={2} />);

 // Initially net score is 3
 expect(screen.getByText("3")).toBeDefined();

 // Click upvote
 fireEvent.click(screen.getByTitle(/^Upvote/));

 // Score should optimistically increase to 4
 expect(screen.getByText("4")).toBeDefined();
 });

 it("toggles vote off when clicking same button", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote="up" upvotes={5} downvotes={2} />);

 // Net score starts at 3
 expect(screen.getByText("3")).toBeDefined();

 // Click upvote again to toggle off
 fireEvent.click(screen.getByTitle(/^Upvote/));

 // Score should decrease to 2
 expect(screen.getByText("2")).toBeDefined();
 });

 it("switches vote when clicking opposite button", () => {
 render(<SuggestionVoteButtons suggestionId="sug-1" currentVote="up" upvotes={5} downvotes={2} />);

 // Net starts at 3
 expect(screen.getByText("3")).toBeDefined();

 // Click downvote (switch from up to down → -2 net)
 fireEvent.click(screen.getByTitle(/^Downvote/));

 // Up decreases by 1 (5→4), down increases by 1 (2→3): 4-3 = 1
 expect(screen.getByText("1")).toBeDefined();
 });
});
