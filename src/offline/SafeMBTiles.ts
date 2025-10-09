// Safe MBTiles wrapper to prevent crashes when native modules are not available
import * as FileSystem from "expo-file-system";

let SQLite: any = null;
let TcpSocket: any = null;
let mime: any = null;

try {
  SQLite = require('react-native-sqlite-storage');
  if (SQLite) {
    SQLite.enablePromise(true);
  }
} catch (e) {
  console.warn('react-native-sqlite-storage not available');
}

try {
  TcpSocket = require('react-native-tcp-socket');
} catch (e) {
  console.warn('react-native-tcp-socket not available');
}

try {
  mime = require('mime');
} catch (e) {
  console.warn('mime not available');
}

type ServerHandle = { close: () => void };
let db: any = null;
let fmt: "png"|"jpg"|"pbf" = "png";
let server: any = null;

function httpResp(status: number, headers: Record<string, string>, body: Uint8Array | string) {
  const h = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
  const head = `HTTP/1.1 ${status} OK\r\n${h}\r\n\r\n`;
  if (typeof body === "string") {return Buffer.concat([Buffer.from(head, "utf8"), Buffer.from(body, "utf8")]);}
  return Buffer.concat([Buffer.from(head, "utf8"), Buffer.from(body)]);
}

export const SafeMBTiles = {
  isAvailable: () => SQLite !== null && TcpSocket !== null && mime !== null,

  openDbFromUri: async (uri: string) => {
    if (!SQLite) {
      console.warn('SQLite not available, database not opened');
      return;
    }
    
    try {
      // Copy MBTiles to app doc dir if content:// or asset; SQLite wants local path
      let path = uri;
      if (!uri.startsWith("/tmp/")) {
        const dest = "/tmp/mbtiles/current.mbtiles";
        await FileSystem.makeDirectoryAsync("/tmp/mbtiles/", { intermediates: true }).catch(() => {});
        await FileSystem.copyAsync({ from: uri, to: dest });
        path = dest;
      }
      db = await SQLite.openDatabase({ name: path, location: "default", createFromLocation: path });
      const rf = await db.executeSql("SELECT value FROM metadata WHERE name='format'");
      fmt = (rf[0].rows.length ? rf[0].rows.item(0).value : "png");
    } catch (e) {
      console.warn('Failed to open MBTiles database:', e);
    }
  },

  readTile: async (z: number, x: number, y: number): Promise<Uint8Array | null> => {
    if (!db) {return null;}
    
    try {
      // MBTiles uses TMS; convert XYZ y->TMS
      const yTms = (1 << z) - 1 - y;
      const res = await db.executeSql(
        "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=? LIMIT 1",
        [z, x, yTms]
      );
      if (!res[0].rows.length) {return null;}
      const base64 = res[0].rows.item(0).tile_data as string;
      return Buffer.from(base64, "base64");
    } catch (e) {
      console.warn('Failed to read tile:', e);
      return null;
    }
  },

  parsePath: (line: string) => {
    // GET /tiles/{z}/{x}/{y}.png HTTP/1.1
    const m = line.match(/GET\s+\/tiles\/(\d+)\/(\d+)\/(\d+)\.(png|jpg|pbf)/i);
    if (!m) {return null;}
    return { z: parseInt(m[1], 10), x: parseInt(m[2], 10), y: parseInt(m[3], 10), ext: m[4].toLowerCase() };
  },

  startMbtilesServer: async (): Promise<ServerHandle> => {
    if (!TcpSocket || !mime) {
      console.warn('TCP Socket or MIME not available, server not started');
      return { close: () => {} };
    }

    if (server) {return { close: () => server.close() };}
    
    try {
      server = TcpSocket.createServer(async (socket: any) => {
        socket.on("data", async (raw: Buffer) => {
          const req = raw.toString("utf8");
          const first = req.split("\r\n")[0] || "";
          const p = SafeMBTiles.parsePath(first);
          if (!p) {
            const body = "AfetNet MBTiles Server";
            socket.write(httpResp(200, { "Content-Type": "text/plain", "Content-Length": String(body.length) }, body));
            return;
          }
          try {
            const tile = await SafeMBTiles.readTile(p.z, p.x, p.y);
            if (!tile) {
              const body = "Not Found";
              socket.write(httpResp(404, { "Content-Type": "text/plain", "Content-Length": String(body.length) }, body));
              return;
            }
            const ctype = mime.getType(`.${p.ext}`) || "application/octet-stream";
            socket.write(httpResp(200, { "Content-Type": ctype, "Content-Length": String(tile.byteLength), "Cache-Control": "max-age=3600" }, tile));
          } catch {
            const body = "Error";
            socket.write(httpResp(500, { "Content-Type": "text/plain", "Content-Length": String(body.length) }, body));
          }
        });
      }).listen({ port: 17311, host: "127.0.0.1" });
      
      return { close: () => { try { server.close(); } catch {} server = null; } };
    } catch (e) {
      console.warn('Failed to start MBTiles server:', e);
      return { close: () => {} };
    }
  },

  stopMbtilesServer: async () => {
    try { server?.close(); } catch {}
    server = null;
  },

  localTileUrlTemplate: () => {
    return "http://127.0.0.1:17311/tiles/{z}/{x}/{y}.png";
  },

  currentFormat: () => fmt
};



