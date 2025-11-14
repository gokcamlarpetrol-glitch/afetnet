/**
 * Message Queue Publisher
 * Publishes normalized earthquake events to RabbitMQ or Kafka
 */

import amqp from 'amqplib';
import { logger } from '../utils/logger';
import { config } from '../config';
import { PrioritizedEvent } from '../types/earthquake';

export interface QueuePublisher {
  publish(event: PrioritizedEvent): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * RabbitMQ Publisher
 */
export class RabbitMQPublisher implements QueuePublisher {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private connected: boolean = false;

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Assert exchange
      await this.channel.assertExchange(config.rabbitmqExchange, 'topic', {
        durable: true,
      });

      this.connected = true;
      logger.info('RabbitMQ connected', {
        exchange: config.rabbitmqExchange,
        routingKey: config.rabbitmqRoutingKey,
      });

      // Handle connection errors
      this.connection.on('error', (error) => {
        logger.error('RabbitMQ connection error', { error: error.message });
        this.connected = false;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.connected = false;
      });
    } catch (error: any) {
      logger.error('Failed to connect to RabbitMQ', { error: error.message });
      throw error;
    }
  }

  async publish(event: PrioritizedEvent): Promise<void> {
    if (!this.connected || !this.channel) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      const message = Buffer.from(JSON.stringify(event));
      const published = this.channel.publish(
        config.rabbitmqExchange,
        config.rabbitmqRoutingKey,
        message,
        {
          persistent: true,
          timestamp: Date.now(),
          messageId: event.id,
        }
      );

      if (!published) {
        throw new Error('Message not published (channel buffer full)');
      }

      logger.debug('Event published to RabbitMQ', {
        eventId: event.id,
        source: event.source,
        magnitude: event.magnitude,
      });
    } catch (error: any) {
      logger.error('Failed to publish event to RabbitMQ', {
        error: error.message,
        eventId: event.id,
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    this.connected = false;
    logger.info('RabbitMQ disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Kafka Publisher (placeholder - requires kafkajs)
 * Uncomment and install kafkajs to use
 */
/*
import { Kafka } from 'kafkajs';

export class KafkaPublisher implements QueuePublisher {
  private producer: any;
  private connected: boolean = false;

  async connect(): Promise<void> {
    const kafka = new Kafka({
      clientId: config.kafkaClientId,
      brokers: config.kafkaBrokers.split(','),
    });

    this.producer = kafka.producer();
    await this.producer.connect();
    this.connected = true;
    logger.info('Kafka connected');
  }

  async publish(event: PrioritizedEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('Kafka not connected');
    }

    await this.producer.send({
      topic: config.kafkaTopic,
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString(),
        },
      ],
    });
  }

  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
*/

// Export default publisher (RabbitMQ)
export const queuePublisher: QueuePublisher = new RabbitMQPublisher();









