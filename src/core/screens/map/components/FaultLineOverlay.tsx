import React from 'react';
import { Geojson } from 'react-native-maps';
import { useMapStore } from '../../../stores/mapStore';

const faultLinesData = require('../../../../assets/data/fault_lines_turkey.json');

export const FaultLineOverlay = () => {
  const showFaultLines = useMapStore((state) => state.filters.showFaultLines);

  if (!showFaultLines) return null;

  return (
    <Geojson
      geojson={faultLinesData}
      strokeColor="rgba(239, 68, 68, 0.6)" // Red with opacity
      strokeWidth={3}
      lineDashPattern={[5, 5]}
    />
  );
};
