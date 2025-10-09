// Safe TCP Socket wrapper to prevent crashes when native modules are not available
let net: any = null;

try {
  net = require('react-native-tcp-socket');
} catch (e) {
  console.warn('react-native-tcp-socket not available');
}

export const SafeTCP = {
  isAvailable: () => net !== null,
  
  createServer: (callback: any) => {
    if (!net) {
      console.warn('TCP Socket not available, returning mock server');
      return {
        listen: (options: any, callback?: any) => {
          console.warn('Mock TCP server listening on port', options.port);
          if (callback) {callback();}
          return {
            close: (callback?: any) => {
              console.warn('Mock TCP server closed');
              if (callback) {callback();}
            }
          };
        },
        close: (callback?: any) => {
          console.warn('Mock TCP server closed');
          if (callback) {callback();}
        }
      };
    }
    try {
      return net.createServer(callback);
    } catch (e) {
      console.warn('Failed to create TCP server:', e);
      return {
        listen: (options: any, callback?: any) => {
          if (callback) {callback();}
          return { close: (callback?: any) => { if (callback) {callback();} } };
        },
        close: (callback?: any) => { if (callback) {callback();} }
      };
    }
  },

  createConnection: (options: any, callback?: any) => {
    if (!net) {
      console.warn('TCP Socket not available, returning mock connection');
      const mockSocket = {
        write: (data: any, callback?: any) => {
          console.warn('Mock TCP write:', data);
          if (callback) {callback();}
        },
        end: (callback?: any) => {
          console.warn('Mock TCP connection ended');
          if (callback) {callback();}
        },
        on: (event: string, callback: any) => {
          console.warn('Mock TCP event listener:', event);
        }
      };
      if (callback) {callback();}
      return mockSocket;
    }
    try {
      return net.createConnection(options, callback);
    } catch (e) {
      console.warn('Failed to create TCP connection:', e);
      const mockSocket = {
        write: (data: any, callback?: any) => { if (callback) {callback();} },
        end: (callback?: any) => { if (callback) {callback();} },
        on: (event: string, callback: any) => {}
      };
      if (callback) {callback();}
      return mockSocket;
    }
  }
};



