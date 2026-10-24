/**
 * Client manager for CFLP Web Worker
 * Spawns worker, handles postMessage RPC, manages in-flight cancellation, and provides synchronous fallback.
 */

import { SolverInput, SolverOutput, WorkerSolveRequest, WorkerSolveResponse } from './types';
import { solveExactCFLP } from './cflpEngine';

class CflpSolverClient {
  private worker: Worker | null = null;
  private currentSolveId = 0;
  private pendingResolvers = new Map<
    number,
    { resolve: (out: SolverOutput) => void; reject: (err: any) => void }
  >();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./cflpWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (event: MessageEvent<WorkerSolveResponse>) => {
          const { id, output, error } = event.data;
          const handler = this.pendingResolvers.get(id);
          if (handler) {
            this.pendingResolvers.delete(id);
            if (error) {
              handler.reject(new Error(error));
            } else {
              handler.resolve(output);
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('CFLP worker error, falling back to direct solve:', err);
        };
      } catch (err) {
        console.warn('Could not initialize CFLP worker, using synchronous solver:', err);
        this.worker = null;
      }
    }
  }

  /**
   * Solves CFLP problem. Cancels previous in-flight solves automatically.
   */
  public async solve(input: SolverInput): Promise<SolverOutput> {
    const solveId = ++this.currentSolveId;

    // In environments without Web Worker (e.g. JSDOM in tests), solve synchronously
    if (!this.worker) {
      return solveExactCFLP(input);
    }

    return new Promise<SolverOutput>((resolve, reject) => {
      // Clear out any old pending resolvers
      this.pendingResolvers.forEach(({ reject }) => {
        reject(new Error('Superseded by newer solve request'));
      });
      this.pendingResolvers.clear();

      this.pendingResolvers.set(solveId, { resolve, reject });

      const request: WorkerSolveRequest = {
        id: solveId,
        input,
      };

      this.worker!.postMessage(request);
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingResolvers.clear();
  }
}

export const cflpSolver = new CflpSolverClient();
