/**
 * AFETNET MAP STYLES
 * "Modern Calm Trust" Design System
 */

import { colors } from './colors';

export const trustMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#F4EFE7", // colors.background.primary (Paper)
      },
    ],
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off",
      },
    ],
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161",
      },
    ],
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#F4EFE7",
      },
    ],
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd",
      },
    ],
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee",
      },
    ],
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575",
      },
    ],
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#E5E5E5", // Subtle green/grey
      },
    ],
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e",
      },
    ],
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff",
      },
    ],
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575",
      },
    ],
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada",
      },
    ],
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161",
      },
    ],
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#D8E6F3", // colors.brand.secondary (Light Blue)
      },
    ],
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e",
      },
    ],
  },
];

export const trustDarkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#121416", // Very Dark Grey/Blue base
      },
    ],
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off",
      },
    ],
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#888D94",
      },
    ],
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#121416",
      },
    ],
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#5B5F66",
      },
    ],
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#1F2329",
      },
    ],
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#5B5F66",
      },
    ],
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#1B221B", // Very dark green
      },
    ],
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#4A769E",
      },
    ],
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#2C3036",
      },
    ],
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#5B5F66",
      },
    ],
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#3D4148",
      },
    ],
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#888D94",
      },
    ],
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#0F172A", // Deepest Blue
      },
    ],
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#4A769E",
      },
    ],
  },
];
