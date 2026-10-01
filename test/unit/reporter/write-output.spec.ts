import { Writable } from "node:stream";
import { setImmediate } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import { writeOutput } from "../../../src/reporter/write-output.js";

describe("reporter stream writer", (): void => {
  it("waits for the callback even when write signals backpressure, without closing the stream", async (): Promise<void> => {
    let complete: ((error?: Error | null) => void) | undefined;
    const chunks: string[] = [];
    const stream = new Writable({ highWaterMark: 1, write(chunk: Buffer, _encoding, callback): void {
      chunks.push(chunk.toString());
      complete = callback;
    } });
    let settled = false;
    const pending = writeOutput(stream, "report\n").then((): void => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(stream.writableNeedDrain).toBe(true);
    if (!complete) throw new Error("Write callback missing");
    complete();
    await pending;
    expect(chunks).toEqual(["report\n"]);
    expect(stream.listenerCount("error")).toBe(0);
    expect(stream.destroyed).toBe(false);
    stream.destroy();
  });

  it.each([false, true])("handles callback failure and its subsequent error event (autoDestroy=$0)", async (autoDestroy): Promise<void> => {
    const error = new Error("test stream failure");
    const stream = new Writable({ autoDestroy, write(_chunk, _encoding, callback): void { callback(error); } });
    await expect(writeOutput(stream, "report\n")).rejects.toBe(error);
    await setImmediate();
    expect(stream.listenerCount("error")).toBe(0);
    stream.destroy();
  });

  it("rejects an error event even if the write callback is still pending", async (): Promise<void> => {
    const stream = new Writable({ write(): void {} });
    const pending = writeOutput(stream, "report\n");
    const error = new Error("test event failure");
    stream.emit("error", error);
    await expect(pending).rejects.toBe(error);
    expect(stream.listenerCount("error")).toBe(0);
    stream.destroy();
  });

  it("removes its listener after a synchronous write exception", async (): Promise<void> => {
    const stream = new Writable({ write(_chunk, _encoding, callback): void { callback(); } });
    vi.spyOn(stream, "write").mockImplementationOnce((): never => { throw new Error("test synchronous failure"); });
    await expect(writeOutput(stream, "report\n")).rejects.toThrow("test synchronous failure");
    expect(stream.listenerCount("error")).toBe(0);
    stream.destroy();
  });
});
