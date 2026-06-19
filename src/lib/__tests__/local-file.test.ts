import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MARKDOWN_PICKER_TYPES,
  isFileSystemAccessSupported,
  fileNameToTitle,
  downloadMarkdown,
  setPendingLocalFile,
  takePendingLocalFile,
  type LocalMarkdownFile,
} from "../local-file";

describe("local-file helpers", () => {
  describe("fileNameToTitle", () => {
    it("strips known markdown extensions", () => {
      expect(fileNameToTitle("notes.md")).toBe("notes");
      expect(fileNameToTitle("README.markdown")).toBe("README");
      expect(fileNameToTitle("draft.mdown")).toBe("draft");
      expect(fileNameToTitle("todo.MKD")).toBe("todo");
      expect(fileNameToTitle("plain.txt")).toBe("plain");
    });

    it("leaves names without a known extension untouched", () => {
      expect(fileNameToTitle("notes")).toBe("notes");
      expect(fileNameToTitle("archive.tar.gz")).toBe("archive.tar.gz");
    });

    it("never returns an empty string", () => {
      expect(fileNameToTitle(".md")).toBe(".md");
    });
  });

  describe("isFileSystemAccessSupported", () => {
    afterEach(() => {
      // jsdom has no showOpenFilePicker by default; clean up any stub.
      delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    });

    it("is false when showOpenFilePicker is absent", () => {
      expect(isFileSystemAccessSupported()).toBe(false);
    });

    it("is true when showOpenFilePicker is present", () => {
      (window as unknown as Record<string, unknown>).showOpenFilePicker = () => {};
      expect(isFileSystemAccessSupported()).toBe(true);
    });
  });

  describe("MARKDOWN_PICKER_TYPES", () => {
    it("accepts the common markdown extensions", () => {
      const accept = MARKDOWN_PICKER_TYPES[0].accept["text/markdown"] as string[];
      expect(accept).toContain(".md");
      expect(accept).toContain(".markdown");
    });
  });

  describe("pending file handoff", () => {
    it("returns null when nothing is pending", () => {
      // drain anything left from earlier tests
      takePendingLocalFile();
      expect(takePendingLocalFile()).toBeNull();
    });

    it("returns the stashed file exactly once", () => {
      const file: LocalMarkdownFile = { handle: null, name: "x.md", text: "# x" };
      setPendingLocalFile(file);
      expect(takePendingLocalFile()).toBe(file);
      expect(takePendingLocalFile()).toBeNull();
    });
  });

  describe("downloadMarkdown", () => {
    beforeEach(() => {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi
        .fn()
        .mockReturnValue("blob:mock");
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
    });

    it("triggers a download with a .md filename", () => {
      const clicks: HTMLAnchorElement[] = [];
      const realClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        clicks.push(this as HTMLAnchorElement);
      };
      try {
        downloadMarkdown("notes", "# hi");
        expect(clicks).toHaveLength(1);
        expect(clicks[0].download).toBe("notes.md");
      } finally {
        HTMLAnchorElement.prototype.click = realClick;
      }
    });

    it("keeps an existing markdown extension", () => {
      const realClick = HTMLAnchorElement.prototype.click;
      let downloadName = "";
      HTMLAnchorElement.prototype.click = function () {
        downloadName = (this as HTMLAnchorElement).download;
      };
      try {
        downloadMarkdown("notes.markdown", "# hi");
        expect(downloadName).toBe("notes.markdown");
      } finally {
        HTMLAnchorElement.prototype.click = realClick;
      }
    });
  });
});
