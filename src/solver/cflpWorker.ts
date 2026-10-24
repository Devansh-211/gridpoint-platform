/**
 * Web Worker for Exact CFLP Solving
 * Runs off the main UI thread so high-frequency editing never drops frames.
 */

import { solveExactCFLP } from './cflpEngine';
import { WorkerSolveRequest, WorkerSolveResponse } from './types';

self.onmessage = (event: MessageEvent<WorkerSolveRequest>) => {
  const { id, input } = event.data;
  try {
    const output = solveExactCFLP(input);
    const response: WorkerSolveResponse = {
      id,
      output,
    };
    self.postMessage(response);
  } catch (err: any) {
    const errorResponse: WorkerSolveResponse = {
      id,
      output: null as any,
      error: err?.message || String(err),
    };
    self.postMessage(errorResponse);
  }
};
