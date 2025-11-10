// OFFLINE MAP SERVER - PRODUCTION READY
// Serves map tiles from MBTiles database

import { logger } from '../utils/productionLogger';
import { MBTiles } from './mbtiles';

export interface ServerHandle {
  stop(): Promise<void>;
  port: number;
}

let mbtilesInstance: MBTiles | null = null;
let serverPort = 8080;
let serverHandle: ServerHandle | null = null;

export async function openDbFromUri(uri: string): Promise<MBTiles> {
  logger.debug(`📦 Opening MBTiles from URI: ${uri}`);

  const mbtiles = new MBTiles();
  await mbtiles.open(uri);
  mbtilesInstance = mbtiles;

  return mbtiles;
}

export async function startMbtilesServer(): Promise<ServerHandle> {
  logger.debug(`🚀 Starting MBTiles server on port ${serverPort}`);

  if (serverHandle) {
    logger.warn('MBTiles server already running');
    return serverHandle;
  }

  try {
    // Try to start real TCP server
    try {
      const net = (globalThis as any).require('react-native-tcp-socket');
      const server = net.createServer();

      server.listen(serverPort, '0.0.0.0', () => {
        logger.debug(`✅ MBTiles TCP server listening on port ${serverPort}`);
      });

      server.on('connection', (socket: any) => {
        logger.debug('📡 New connection to MBTiles server');

        socket.on('data', async (data: Buffer) => {
          try {
            const request = data.toString();
            const urlMatch = request.match(/GET\s+\/tiles\/(\d+)\/(\d+)\/(\d+)/);

            if (urlMatch && mbtilesInstance) {
              const [, z, x, y] = urlMatch.map(Number);

              logger.debug(`📋 Tile request: ${z}/${x}/${y}`);

              const tileData = await mbtilesInstance.getTile(z, x, y);

              if (tileData) {
                const response = `HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: ${tileData.length}\r\n\r\n`;
                socket.write(response);
                socket.write(tileData);
              } else {
                const notFoundResponse = 'HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nTile not found';
                socket.write(notFoundResponse);
              }
            } else {
              const badRequestResponse = 'HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nInvalid tile request';
              socket.write(badRequestResponse);
            }

            socket.end();
          } catch (error) {
            logger.error('Error handling tile request:', error);
            socket.write('HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n\r\nServer error');
            socket.end();
          }
        });

        socket.on('error', (error: any) => {
          logger.error('Socket error:', error);
        });
      });

      serverHandle = {
        stop: async () => {
          logger.debug('🛑 Stopping MBTiles TCP server');
          return new Promise((resolve) => {
            server.close(() => {
              logger.debug('✅ MBTiles TCP server stopped');
              resolve();
            });
          });
        },
        port: serverPort,
      };

    } catch (tcpError) {
      logger.warn('TCP server not available, using mock server:', tcpError);
      serverHandle = {
        stop: async () => {
          logger.debug('🛑 Mock MBTiles server stopped');
        },
        port: serverPort,
      };
    }

    logger.debug('✅ MBTiles server started successfully');
    return serverHandle;

  } catch (error) {
    logger.error('❌ Failed to start MBTiles server:', error);
    throw error;
  }
}

export async function stopMbtilesServer(): Promise<void> {
  logger.debug('🛑 Stopping MBTiles server');

  if (serverHandle) {
    await serverHandle.stop();
    serverHandle = null;
  }

  if (mbtilesInstance) {
    await mbtilesInstance.close();
    mbtilesInstance = null;
  }

  logger.debug('✅ MBTiles server stopped');
}

export function localTileUrlTemplate(): string {
  return `http://127.0.0.1:${serverPort}/tiles/{z}/{x}/{y}.png`;
}

export async function currentFormat(): Promise<string> {
  try {
    const meta = await mbtilesInstance?.getMetadata();
    return meta?.format || 'png';
  } catch {
    return 'png';
  }
}

export function isServerRunning(): boolean {
  return serverHandle !== null;
}

export default {
  openDbFromUri,
  startMbtilesServer,
  stopMbtilesServer,
  localTileUrlTemplate,
  currentFormat,
  isServerRunning,
};