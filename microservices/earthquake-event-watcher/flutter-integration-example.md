# Flutter Integration Example

This document shows how to integrate the Earthquake Event Watcher with your Flutter mobile app.

## Prerequisites

Add these dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  amqp_client: ^2.0.0  # For RabbitMQ
  # OR
  kafka: ^0.1.0  # For Kafka
  geolocator: ^10.0.0  # For location
  flutter_local_notifications: ^16.0.0  # For notifications
```

## RabbitMQ Consumer Example

```dart
import 'package:amqp_client/amqp_client.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class EarthquakeNotificationService {
  late AmqpClient client;
  final FlutterLocalNotificationsPlugin notifications = FlutterLocalNotificationsPlugin();
  Position? userLocation;
  final double radiusKm = 50.0; // From config.USER_RADIUS_KM

  Future<void> initialize() async {
    // Initialize notifications
    await notifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );

    // Get user location
    userLocation = await Geolocator.getCurrentPosition();

    // Connect to RabbitMQ
    client = AmqpClient(
      settings: ConnectionSettings(
        host: 'your-rabbitmq-host',
        port: 5672,
        username: 'guest',
        password: 'guest',
      ),
    );

    await client.connect();
    await subscribeToEarthquakes();
  }

  Future<void> subscribeToEarthquakes() async {
    final channel = await client.channel();
    final queue = await channel.queue('earthquake.events');

    await queue.consume((message) async {
      final event = EarthquakeEvent.fromJson(jsonDecode(message.payloadAsString));
      
      // Check if earthquake is within user radius
      if (userLocation != null && isWithinRadius(event, userLocation!)) {
        await showNotification(event);
      }

      message.ack();
    });
  }

  bool isWithinRadius(EarthquakeEvent event, Position userLocation) {
    final distance = Geolocator.distanceBetween(
      userLocation.latitude,
      userLocation.longitude,
      event.latitude,
      event.longitude,
    );
    return distance <= radiusKm * 1000; // Convert km to meters
  }

  Future<void> showNotification(EarthquakeEvent event) async {
    await notifications.show(
      event.id.hashCode,
      'Deprem Tespit Edildi',
      'Magnitüd: ${event.magnitude.toStringAsFixed(1)} ML\nKonum: ${event.location ?? 'Bilinmiyor'}',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'earthquake_channel',
          'Deprem Bildirimleri',
          channelDescription: 'Gerçek zamanlı deprem bildirimleri',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }
}

class EarthquakeEvent {
  final String id;
  final int timestamp;
  final double magnitude;
  final double latitude;
  final double longitude;
  final String? location;
  final String source;

  EarthquakeEvent({
    required this.id,
    required this.timestamp,
    required this.magnitude,
    required this.latitude,
    required this.longitude,
    this.location,
    required this.source,
  });

  factory EarthquakeEvent.fromJson(Map<String, dynamic> json) {
    return EarthquakeEvent(
      id: json['id'],
      timestamp: json['timestamp'],
      magnitude: (json['magnitude'] as num).toDouble(),
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      location: json['location'],
      source: json['source'],
    );
  }
}
```

## Usage in Flutter App

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final earthquakeService = EarthquakeNotificationService();
  await earthquakeService.initialize();
  
  runApp(MyApp());
}
```

## Configuration

Update the RabbitMQ connection settings and radius in your Flutter app to match the microservice configuration.

