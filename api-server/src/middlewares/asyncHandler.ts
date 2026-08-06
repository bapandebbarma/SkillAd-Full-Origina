/**
 * Forwards rejected promises from async route handlers to Express error middleware.
 * Express 5 already does this for native async handlers; this helper is available
 * for handlers that mix callbacks / non-standard promise usage without rewriting routes.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
