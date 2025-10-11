// Safe TCP Socket wrapper to prevent crashes when native modules are not available
import { logger } from '../utils/productionLogger';
let net: any = null;

try {
  net = require('react-native-tcp-socket');
} catch (e) {
  logger.warn('react-native-tcp-socket not available');
}

export const SafeTCP = {
  isAvailable: () => net !== null,
  
  createServer: (callback: any) => {
    if (!net) {
      logger.warn('TCP Socket not available, returning mock server');
      return {
        listen: (options: Record<string, unknown>, callback?: any) => {
          logger.warn('Mock TCP server listening on port', options.port);
          if (callback) {callback();}
          return {
            close: (callback?: any) => {
              logger.warn('Mock TCP server closed');
              if (callback) {callback();}
            }
          };
        },
        close: (callback?: any) => {
          logger.warn('Mock TCP server closed');
          if (callback) {callback();}
        }
      };
    }
    try {
      return net.createServer(callback);
    } catch (e) {
      logger.warn('Failed to create TCP server:', e);
      return {
        listen: (options: Record<string, unknown>, callback?: any) => {
          if (callback) {callback();}
          return { close: (callback?: any) => { if (callback) {callback();} } };
        },
        close: (callback?: any) => { if (callback) {callback();} }
      };
    }
  },

  createConnection: (options: Record<string, unknown>, callback?: any) => {
    if (!net) {
      logger.warn('TCP Socket not available, returning mock connection');
      const mockSocket = {
        write: (data: unknown, callback?: any) => {
          logger.warn('Mock TCP write:', data);
          if (callback) {callback();}
        },
        end: (callback?: any) => {
          logger.warn('Mock TCP connection ended');
          if (callback) {callback();}
        },
        on: (event: string, callback: any) => {
          logger.warn('Mock TCP event listener:', event);
        }
      };
      if (callback) {callback();}
      return mockSocket;
    }
    try {
      return net.createConnection(options, callback);
    } catch (e) {
      logger.warn('Failed to create TCP connection:', e);
      const mockSocket = {
        write: (data: unknown, callback?: any) => { if (callback) {callback();} },
        end: (callback?: any) => { if (callback) {callback();} },
        on: (event: string, callback: any) => {}
      };
      if (callback) {callback();}
      return mockSocket;
    }
  }
};



