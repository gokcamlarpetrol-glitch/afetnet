import React from "react";
import { UrlTile } from "react-native-maps";
import * as FileSystem from "expo-file-system";

export default function MbTileOverlay(){
  // Serve mbtiles via local file protocol using expo-file-system
  // For simplicity, assume a companion local http bridge is used or preconverted to {z}/{x}/{y}.png in tiles/
  return (
    <UrlTile
      urlTemplate={"/tmp/tiles/{z}/{x}/{y}.png"}
      maximumZ={18}
      flipY={false}
      zIndex={0}
    />
  );
}
