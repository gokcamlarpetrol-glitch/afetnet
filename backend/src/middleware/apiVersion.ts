import { NextFunction, Request, Response } from 'express';

/**
 * API Versioning Middleware
 * CRITICAL: Allows backward compatibility when API changes
 * Supports multiple API versions simultaneously
 */

export interface VersionedRequest extends Request {
  apiVersion?: string;
}

export const apiVersion = (req: VersionedRequest, res: Response, next: NextFunction) => {
  // Get version from header or URL
  const versionHeader = req.headers['api-version'] as string;
  const matchResult = req.path.match(/^\/api\/v(\d+)\//);
  const versionUrl = matchResult ? matchResult[1] : null;

  req.apiVersion = versionHeader || (versionUrl ? `v${versionUrl}` : 'v1');

  // Add version to response headers
  res.setHeader('API-Version', req.apiVersion);

  next();
};

/**
 * Require specific API version
 */
export const requireVersion = (version: string) => {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    if (req.apiVersion !== version) {
      return res.status(400).json({
        error: 'API_VERSION_MISMATCH',
        message: `This endpoint requires API version ${version}`,
        currentVersion: req.apiVersion,
      });
    }
    next();
  };
};

/**
 * Deprecation warning
 */
export const deprecateVersion = (version: string, sunsetDate: string) => {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    if (req.apiVersion === version) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', sunsetDate);
      res.setHeader('Link', '</api/v2>; rel="successor-version"');
    }
    next();
  };
};
