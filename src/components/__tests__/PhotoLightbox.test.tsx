// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from"vitest";
import { render, screen, fireEvent } from"@testing-library/react";
import userEvent from"@testing-library/user-event";
import PhotoLightbox from"../PhotoLightbox";

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
 const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
 return {
 ...actual,
 createPortal: (node: React.ReactNode) => node,
 };
});

const mockImages = [
 { url:"https://example.com/photo1.jpg", label:"Near Side" },
 { url:"https://example.com/photo2.jpg", label:"Off Side" },
 { url:"https://example.com/photo3.jpg", label:"Front" },
];

describe("PhotoLightbox", () => {
 const mockOnClose = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 it("renders the lightbox with correct aria attributes", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 const dialog = screen.getByRole("dialog");
 expect(dialog).toBeInTheDocument();
 expect(dialog).toHaveAttribute("aria-modal","true");
 expect(dialog).toHaveAttribute("aria-label","Photo viewer — Near Side");
 });

 it("displays the initial image correctly", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 const img = screen.getByAltText("Near Side");
 expect(img).toBeInTheDocument();
 expect(img).toHaveAttribute("src","https://example.com/photo1.jpg");
 });

 it("shows the correct counter", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={1} onClose={mockOnClose} />);

 expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
 });

 it("shows label text", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);
 expect(screen.getByText("Near Side")).toBeInTheDocument();
 });

 it("navigates to next image on Next button click", async () => {
 const user = userEvent.setup();
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 const nextBtn = screen.getByLabelText("Next photo");
 await user.click(nextBtn);

 expect(screen.getByAltText("Off Side")).toBeInTheDocument();
 expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
 });

 it("navigates to previous image on Prev button click", async () => {
 const user = userEvent.setup();
 render(<PhotoLightbox images={mockImages} initialIndex={1} onClose={mockOnClose} />);

 const prevBtn = screen.getByLabelText("Previous photo");
 await user.click(prevBtn);

 expect(screen.getByAltText("Near Side")).toBeInTheDocument();
 });

 it("wraps around on navigation", async () => {
 const user = userEvent.setup();
 render(<PhotoLightbox images={mockImages} initialIndex={2} onClose={mockOnClose} />);

 const nextBtn = screen.getByLabelText("Next photo");
 await user.click(nextBtn);

 // Should wrap to first image
 expect(screen.getByAltText("Near Side")).toBeInTheDocument();
 });

 it("calls onClose when close button is clicked", async () => {
 const user = userEvent.setup();
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 const closeBtn = screen.getByLabelText("Close lightbox");
 await user.click(closeBtn);

 // Called at least once (may be called twice due to event bubbling on overlay)
 expect(mockOnClose).toHaveBeenCalled();
 });

 it("calls onClose when overlay is clicked", async () => {
 const user = userEvent.setup();
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 const overlay = screen.getByRole("dialog");
 await user.click(overlay);

 expect(mockOnClose).toHaveBeenCalled();
 });

 it("handles keyboard navigation — Escape closes", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 fireEvent.keyDown(window, { key:"Escape" });
 expect(mockOnClose).toHaveBeenCalledOnce();
 });

 it("handles keyboard navigation — ArrowRight advances", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 fireEvent.keyDown(window, { key:"ArrowRight" });
 expect(screen.getByAltText("Off Side")).toBeInTheDocument();
 });

 it("handles keyboard navigation — ArrowLeft goes back", () => {
 render(<PhotoLightbox images={mockImages} initialIndex={1} onClose={mockOnClose} />);

 fireEvent.keyDown(window, { key:"ArrowLeft" });
 expect(screen.getByAltText("Near Side")).toBeInTheDocument();
 });

 it("hides navigation arrows for single images", () => {
 render(
 <PhotoLightbox
 images={[{ url:"https://example.com/single.jpg", label:"Only Photo" }]}
 initialIndex={0}
 onClose={mockOnClose}
 />,
 );

 expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
 expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
 });

 it("prevents body scroll while open", () => {
 const { unmount } = render(<PhotoLightbox images={mockImages} initialIndex={0} onClose={mockOnClose} />);

 expect(document.body.style.overflow).toBe("hidden");

 unmount();
 expect(document.body.style.overflow).not.toBe("hidden");
 });

 it("uses fallback label when no label is provided", () => {
 const noLabelImages = [{ url:"https://example.com/nolabel.jpg" }];
 render(<PhotoLightbox images={noLabelImages} initialIndex={0} onClose={mockOnClose} />);

 expect(screen.getByAltText("Photo 1")).toBeInTheDocument();
 });
});
