// Await the write callback, not the boolean backpressure indication. On failure,
// Node calls the callback before emitting 'error', so keep the listener through
// that turn even when the callback has already rejected the promise.
export function writeOutput(stream: NodeJS.WritableStream, text: string): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const cleanup = (): void => { stream.removeListener("error", onError); };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    stream.once("error", onError);
    try {
      stream.write(text, (error?: Error | null): void => {
        if (error) {
          setImmediate(cleanup);
          reject(error);
        } else {
          cleanup();
          resolve();
        }
      });
    } catch (error: unknown) {
      cleanup();
      reject(error);
    }
  });
}
