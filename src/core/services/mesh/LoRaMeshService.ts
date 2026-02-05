/**
 * LORA MESH SERVICE - ELITE EDITION
 * 
 * Long-range mesh networking via LoRa modules.
 * Extends communication range to 2-15km in open areas.
 * 
 * ARCHITECTURE:
 * - Serial/BLE bridge to external LoRa module
 * - Packet-based protocol (LoRa modulation)
 * - Store & forward for sparse networks
 * - Emergency beacon mode
 * 
 * HARDWARE SUPPORT:
 * - TTGO T-Beam (ESP32 + LoRa + GPS)
 * - Heltec LoRa V3
 * - RAK4631 WisBlock
 * - Meshtastic compatible devices
 * 
 * USE CASES:
 * - Rural disaster area communication
 * - Mountain rescue operations
 * - Maritime emergencies
 * - Last-mile mesh extension
 * 
 * @author AfetNet Elite Team
 * @version 2.0.0
 */

import { createLogger } from '../../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, NativeEventEmitter, DeviceEventEmitter } from 'react-native';
import { meshCompressionService } from './MeshCompressionService';

const logger = createLogger('LoRaMeshService');

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    KNOWN_NODES: '@lora_mesh:known_nodes',
    PENDING_MESSAGES: '@lora_mesh:pending_messages',
    BEACON_CONFIG: '@lora_mesh:beacon_config',
};

const CONFIG = {
    // LoRa Parameters (EU868 region defaults)
    FREQUENCY: 868.1, // MHz
    SPREADING_FACTOR: 10, // SF7-SF12 (higher = longer range, slower)
    BANDWIDTH: 125, // kHz
    CODING_RATE: 5, // 4/5
    TX_POWER: 14, // dBm (max 17 for EU868)
    PREAMBLE_LENGTH: 8,

    // Protocol
    MAX_PACKET_SIZE: 230, // bytes (LoRa limit ~255 with overhead)
    MAX_PAYLOAD_SIZE: 200, // bytes (after headers)
    HEADER_SIZE: 20, // bytes

    // Timing
    RX_TIMEOUT_MS: 5000,
    TX_TIMEOUT_MS: 10000,
    BEACON_INTERVAL_MS: 60000, // 1 minute
    CHANNEL_SCAN_INTERVAL_MS: 30000,
    DUTY_CYCLE_LIMIT: 0.01, // 1% duty cycle (EU regulation)

    // Network
    MAX_HOPS: 5,
    MAX_NODES: 100,
    NODE_TIMEOUT_MS: 3600000, // 1 hour

    // Performance
    AIR_TIME_BUDGET_MS: 36000, // Per hour (1% of 3600s)
};

// ============================================================================
// TYPES
// ============================================================================

export interface LoRaNode {
    nodeId: string;
    shortId: number; // 16-bit
    name: string;
    rssi: number;
    snr: number; // Signal-to-Noise Ratio
    distance?: number; // Estimated km
    position?: {
        lat: number;
        lng: number;
        altitude?: number;
    };
    batteryLevel?: number; // 0-100
    lastSeen: number;
    hopCount: number;
    capabilities: LoRaCapability[];
    isRelay: boolean;
}

export type LoRaCapability = 'gps' | 'relay' | 'beacon' | 'sos' | 'sensor' | 'gateway';

export interface LoRaPacket {
    id: number; // 16-bit packet ID
    type: LoRaPacketType;
    sourceId: number; // 16-bit
    destId: number; // 16-bit (0xFFFF for broadcast)
    flags: LoRaPacketFlags;
    hopCount: number;
    payload: Uint8Array;
    timestamp: number;
}

export enum LoRaPacketType {
    BEACON = 0x01,
    MESSAGE = 0x02,
    ACK = 0x03,
    SOS = 0x04,
    LOCATION = 0x05,
    SENSOR = 0x06,
    DISCOVERY = 0x07,
    ROUTE = 0x08,
}

export interface LoRaPacketFlags {
    requireAck: boolean;
    isRelay: boolean;
    isCompressed: boolean;
    isEncrypted: boolean;
    priority: 'normal' | 'high' | 'emergency';
}

export interface LoRaMessage {
    id: string;
    type: 'text' | 'sos' | 'location' | 'sensor';
    senderId: string;
    recipientId?: string;
    content: string;
    priority: 'normal' | 'high' | 'emergency';
    timestamp: number;
    ttl: number;
    acked?: boolean;
    position?: { lat: number; lng: number };
}

export interface LoRaStats {
    packetsReceived: number;
    packetsSent: number;
    bytesReceived: number;
    bytesSent: number;
    airTimeUsedMs: number;
    airTimeRemainingMs: number;
    nodesDiscovered: number;
    averageRssi: number;
    averageSnr: number;
    lastBeaconTime: number;
}

type LoRaModuleState = 'disconnected' | 'connecting' | 'connected' | 'transmitting' | 'receiving' | 'error';

// ============================================================================
// LORA MESH SERVICE CLASS
// ============================================================================

class LoRaMeshService {
    private isInitialized = false;
    private myNodeId = 0;
    private myName = '';
    private moduleState: LoRaModuleState = 'disconnected';

    // Node tracking
    private knownNodes: Map<number, LoRaNode> = new Map();
    private packetIdCounter = 0;
    private seenPacketIds: Set<number> = new Set();

    // Message queues
    private outgoingQueue: LoRaMessage[] = [];
    private pendingAcks: Map<number, { message: LoRaMessage; retries: number; sentAt: number }> = new Map();

    // Timers
    private beaconTimer: NodeJS.Timeout | null = null;
    private scanTimer: NodeJS.Timeout | null = null;
    private dutyCycleTimer: NodeJS.Timeout | null = null;

    // Stats
    private stats: LoRaStats = {
        packetsReceived: 0,
        packetsSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        airTimeUsedMs: 0,
        airTimeRemainingMs: CONFIG.AIR_TIME_BUDGET_MS,
        nodesDiscovered: 0,
        averageRssi: 0,
        averageSnr: 0,
        lastBeaconTime: 0,
    };

    // Native bridge
    private nativeModule: any = null;
    private eventEmitter: NativeEventEmitter | null = null;

    // Event callbacks
    private onNodeDiscoveredCallbacks: Array<(node: LoRaNode) => void> = [];
    private onMessageReceivedCallbacks: Array<(message: LoRaMessage) => void> = [];
    private onSOSReceivedCallbacks: Array<(sos: LoRaMessage) => void> = [];
    private onStateChangedCallbacks: Array<(state: LoRaModuleState) => void> = [];

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(deviceId: string, deviceName: string): Promise<void> {
        if (this.isInitialized) return;

        logger.info('📡 Initializing LoRaMeshService...');

        try {
            // Generate 16-bit node ID from device ID
            this.myNodeId = this.hashToShortId(deviceId);
            this.myName = deviceName;

            // Load persisted data
            await this.loadKnownNodes();

            // Setup native module
            await this.setupNativeModule();

            // Reset hourly duty cycle budget
            this.startDutyCycleReset();

            this.isInitialized = true;
            logger.info(`✅ LoRaMeshService initialized: Node ${this.myNodeId.toString(16).toUpperCase()}`);
        } catch (error) {
            logger.error('❌ LoRaMeshService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup native LoRa module bridge
     */
    private async setupNativeModule(): Promise<void> {
        try {
            // Try to connect to native module
            this.nativeModule = NativeModules.LoRaModule;

            if (this.nativeModule) {
                this.eventEmitter = new NativeEventEmitter(this.nativeModule);
                this.setupNativeListeners();

                // Initialize LoRa module with parameters
                await this.nativeModule.initialize({
                    frequency: CONFIG.FREQUENCY,
                    spreadingFactor: CONFIG.SPREADING_FACTOR,
                    bandwidth: CONFIG.BANDWIDTH,
                    codingRate: CONFIG.CODING_RATE,
                    txPower: CONFIG.TX_POWER,
                });

                this.setModuleState('connected');
            } else {
                logger.warn('⚠️ LoRa native module not available, using simulation');
                this.setModuleState('disconnected');
            }
        } catch (error) {
            logger.warn('LoRa native setup failed:', error);
            this.setModuleState('error');
        }
    }

    /**
     * Setup native event listeners
     */
    private setupNativeListeners(): void {
        if (!this.eventEmitter) return;

        this.eventEmitter.addListener('onPacketReceived', (data: any) => {
            this.handlePacketReceived(data);
        });

        this.eventEmitter.addListener('onTransmitComplete', (success: boolean) => {
            this.handleTransmitComplete(success);
        });

        this.eventEmitter.addListener('onModuleError', (error: any) => {
            this.handleModuleError(error);
        });
    }

    // ============================================================================
    // BEACON SYSTEM
    // ============================================================================

    /**
     * Start periodic beacon transmission
     */
    startBeacon(): void {
        this.stopBeacon();

        logger.info('📡 Starting LoRa beacon...');

        this.beaconTimer = setInterval(() => {
            this.transmitBeacon();
        }, CONFIG.BEACON_INTERVAL_MS);

        // Send initial beacon
        this.transmitBeacon();
    }

    /**
     * Stop beacon
     */
    stopBeacon(): void {
        if (this.beaconTimer) {
            clearInterval(this.beaconTimer);
            this.beaconTimer = null;
        }
    }

    /**
     * Transmit beacon packet
     */
    private async transmitBeacon(): Promise<void> {
        if (!this.canTransmit()) {
            logger.warn('Cannot transmit: duty cycle limit reached');
            return;
        }

        const beaconPayload = this.createBeaconPayload();

        const packet: LoRaPacket = {
            id: this.getNextPacketId(),
            type: LoRaPacketType.BEACON,
            sourceId: this.myNodeId,
            destId: 0xFFFF, // Broadcast
            flags: {
                requireAck: false,
                isRelay: false,
                isCompressed: false,
                isEncrypted: false,
                priority: 'normal',
            },
            hopCount: 0,
            payload: beaconPayload,
            timestamp: Date.now(),
        };

        await this.transmitPacket(packet);
        this.stats.lastBeaconTime = Date.now();
    }

    /**
     * Create beacon payload
     */
    private createBeaconPayload(): Uint8Array {
        // Beacon format: [nameLength, name..., capabilities, batteryLevel]
        const nameBytes = new TextEncoder().encode(this.myName.slice(0, 20));
        const payload = new Uint8Array(nameBytes.length + 3);

        payload[0] = nameBytes.length;
        payload.set(nameBytes, 1);
        payload[nameBytes.length + 1] = this.getCapabilitiesByte();
        payload[nameBytes.length + 2] = 100; // Battery level placeholder

        return payload;
    }

    // ============================================================================
    // MESSAGE HANDLING
    // ============================================================================

    /**
     * Send a message via LoRa
     */
    async sendMessage(
        content: string,
        options: {
            recipientId?: string;
            priority?: 'normal' | 'high' | 'emergency';
            type?: 'text' | 'sos' | 'location';
            position?: { lat: number; lng: number };
        } = {}
    ): Promise<string> {
        this.ensureInitialized();

        const {
            recipientId,
            priority = 'normal',
            type = 'text',
            position,
        } = options;

        // Create message
        const messageId = `lora-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const message: LoRaMessage = {
            id: messageId,
            type,
            senderId: this.myNodeId.toString(16),
            recipientId,
            content,
            priority,
            timestamp: Date.now(),
            ttl: CONFIG.MAX_HOPS,
            position,
        };

        // Compress if beneficial
        let payload = content;
        let isCompressed = false;

        if (content.length > 50) {
            const compressed = await meshCompressionService.compress(content);
            if (compressed.length < content.length * 0.8) {
                payload = compressed;
                isCompressed = true;
            }
        }

        // Check payload size
        if (payload.length > CONFIG.MAX_PAYLOAD_SIZE) {
            throw new Error(`Message too large: ${payload.length} > ${CONFIG.MAX_PAYLOAD_SIZE} bytes`);
        }

        // Create packet
        const packet: LoRaPacket = {
            id: this.getNextPacketId(),
            type: type === 'sos' ? LoRaPacketType.SOS :
                type === 'location' ? LoRaPacketType.LOCATION :
                    LoRaPacketType.MESSAGE,
            sourceId: this.myNodeId,
            destId: recipientId ? this.hashToShortId(recipientId) : 0xFFFF,
            flags: {
                requireAck: !!recipientId,
                isRelay: false,
                isCompressed,
                isEncrypted: false,
                priority,
            },
            hopCount: 0,
            payload: new TextEncoder().encode(payload),
            timestamp: Date.now(),
        };

        // Add to pending if ACK required
        if (packet.flags.requireAck) {
            this.pendingAcks.set(packet.id, {
                message,
                retries: 0,
                sentAt: Date.now(),
            });
        }

        // Transmit
        await this.transmitPacket(packet);

        logger.info(`📤 Sent LoRa message: ${messageId} (${payload.length} bytes)`);
        return messageId;
    }

    /**
     * Send SOS emergency beacon
     */
    async sendSOS(reason: string, position?: { lat: number; lng: number }): Promise<string> {
        logger.warn('🆘 Sending LoRa SOS beacon!');

        // SOS gets highest priority and continuous retransmission
        const messageId = await this.sendMessage(
            JSON.stringify({ reason, position, timestamp: Date.now() }),
            {
                priority: 'emergency',
                type: 'sos',
                position,
            }
        );

        // Start SOS beacon mode
        this.startSOSBeacon(reason, position);

        return messageId;
    }

    /**
     * Start continuous SOS beacon
     */
    private startSOSBeacon(reason: string, position?: { lat: number; lng: number }): void {
        // Stop regular beacon
        this.stopBeacon();

        // Start SOS beacon (every 30 seconds)
        this.beaconTimer = setInterval(async () => {
            await this.sendMessage(
                JSON.stringify({ reason, position, timestamp: Date.now() }),
                { priority: 'emergency', type: 'sos', position }
            );
        }, 30000);
    }

    /**
     * Send current location
     */
    async sendLocation(lat: number, lng: number, altitude?: number): Promise<string> {
        const compressedLocation = meshCompressionService.compressLocation(lat, lng);

        return this.sendMessage(
            altitude ? `${compressedLocation}:${Math.round(altitude)}` : compressedLocation,
            {
                type: 'location',
                position: { lat, lng },
            }
        );
    }

    // ============================================================================
    // PACKET TRANSMISSION
    // ============================================================================

    /**
     * Check if transmission is allowed (duty cycle)
     */
    private canTransmit(): boolean {
        return this.stats.airTimeRemainingMs > 0;
    }

    /**
     * Transmit a packet
     */
    private async transmitPacket(packet: LoRaPacket): Promise<void> {
        if (!this.canTransmit()) {
            logger.warn('Transmission blocked: duty cycle limit');
            this.outgoingQueue.push(this.packetToMessage(packet));
            return;
        }

        const rawPacket = this.encodePacket(packet);
        const airTimeMs = this.calculateAirTime(rawPacket.length);

        // Check if we have budget
        if (airTimeMs > this.stats.airTimeRemainingMs) {
            logger.warn(`Not enough air time budget: need ${airTimeMs}ms, have ${this.stats.airTimeRemainingMs}ms`);
            return;
        }

        this.setModuleState('transmitting');

        try {
            if (this.nativeModule) {
                await this.nativeModule.transmit(Array.from(rawPacket));
            } else {
                // Simulation
                await new Promise(resolve => setTimeout(resolve, airTimeMs));
            }

            // Update stats
            this.stats.packetsSent++;
            this.stats.bytesSent += rawPacket.length;
            this.stats.airTimeUsedMs += airTimeMs;
            this.stats.airTimeRemainingMs -= airTimeMs;

            logger.debug(`📡 Transmitted ${rawPacket.length} bytes (air time: ${airTimeMs}ms)`);
        } catch (error) {
            logger.error('Transmission failed:', error);
            this.setModuleState('error');
        }

        this.setModuleState('connected');
    }

    /**
     * Encode packet to bytes
     */
    private encodePacket(packet: LoRaPacket): Uint8Array {
        // Header format (20 bytes):
        // [0-1] Packet ID
        // [2] Type
        // [3-4] Source ID
        // [5-6] Dest ID
        // [7] Flags
        // [8] Hop Count
        // [9-12] Timestamp (Unix seconds)
        // [13-19] Reserved

        const header = new Uint8Array(CONFIG.HEADER_SIZE);
        const view = new DataView(header.buffer);

        view.setUint16(0, packet.id, true);
        header[2] = packet.type;
        view.setUint16(3, packet.sourceId, true);
        view.setUint16(5, packet.destId, true);
        header[7] = this.encodeFlags(packet.flags);
        header[8] = packet.hopCount;
        view.setUint32(9, Math.floor(packet.timestamp / 1000), true);

        // Combine header and payload
        const result = new Uint8Array(CONFIG.HEADER_SIZE + packet.payload.length);
        result.set(header);
        result.set(packet.payload, CONFIG.HEADER_SIZE);

        return result;
    }

    /**
     * Decode packet from bytes
     */
    private decodePacket(data: Uint8Array): LoRaPacket | null {
        if (data.length < CONFIG.HEADER_SIZE) {
            return null;
        }

        const view = new DataView(data.buffer, data.byteOffset);

        return {
            id: view.getUint16(0, true),
            type: data[2] as LoRaPacketType,
            sourceId: view.getUint16(3, true),
            destId: view.getUint16(5, true),
            flags: this.decodeFlags(data[7]),
            hopCount: data[8],
            timestamp: view.getUint32(9, true) * 1000,
            payload: data.slice(CONFIG.HEADER_SIZE),
        };
    }

    /**
     * Encode flags to byte
     */
    private encodeFlags(flags: LoRaPacketFlags): number {
        let byte = 0;
        if (flags.requireAck) byte |= 0x01;
        if (flags.isRelay) byte |= 0x02;
        if (flags.isCompressed) byte |= 0x04;
        if (flags.isEncrypted) byte |= 0x08;
        if (flags.priority === 'high') byte |= 0x10;
        if (flags.priority === 'emergency') byte |= 0x20;
        return byte;
    }

    /**
     * Decode flags from byte
     */
    private decodeFlags(byte: number): LoRaPacketFlags {
        return {
            requireAck: !!(byte & 0x01),
            isRelay: !!(byte & 0x02),
            isCompressed: !!(byte & 0x04),
            isEncrypted: !!(byte & 0x08),
            priority: (byte & 0x20) ? 'emergency' : (byte & 0x10) ? 'high' : 'normal',
        };
    }

    /**
     * Calculate air time for packet
     */
    private calculateAirTime(payloadBytes: number): number {
        // LoRa air time calculation (simplified)
        // See SemTech AN1200.13 for detailed formula
        const sf = CONFIG.SPREADING_FACTOR;
        const bw = CONFIG.BANDWIDTH * 1000; // Hz
        const cr = CONFIG.CODING_RATE;
        const preamble = CONFIG.PREAMBLE_LENGTH;

        const symbolDuration = (1 << sf) / bw * 1000; // ms
        const preambleDuration = (preamble + 4.25) * symbolDuration;

        const payloadSymbols = 8 + Math.max(
            Math.ceil((8 * payloadBytes - 4 * sf + 28) / (4 * sf)) * cr,
            0
        );
        const payloadDuration = payloadSymbols * symbolDuration;

        return Math.ceil(preambleDuration + payloadDuration);
    }

    // ============================================================================
    // PACKET RECEPTION
    // ============================================================================

    /**
     * Handle received packet
     */
    private async handlePacketReceived(data: any): Promise<void> {
        const rawData = new Uint8Array(data.bytes);
        const rssi = data.rssi || -100;
        const snr = data.snr || 0;

        const packet = this.decodePacket(rawData);
        if (!packet) {
            logger.warn('Invalid packet received');
            return;
        }

        // Check for duplicate
        if (this.seenPacketIds.has(packet.id)) {
            return;
        }
        this.seenPacketIds.add(packet.id);

        // Limit seen IDs
        if (this.seenPacketIds.size > 1000) {
            const idsArray = Array.from(this.seenPacketIds);
            this.seenPacketIds = new Set(idsArray.slice(-500));
        }

        // Update stats
        this.stats.packetsReceived++;
        this.stats.bytesReceived += rawData.length;
        this.updateRssiStats(rssi, snr);

        logger.debug(`📥 Received packet from ${packet.sourceId.toString(16)} (RSSI: ${rssi}, SNR: ${snr})`);

        // Process by type
        switch (packet.type) {
            case LoRaPacketType.BEACON:
                this.handleBeacon(packet, rssi, snr);
                break;
            case LoRaPacketType.MESSAGE:
                await this.handleMessage(packet, rssi, snr);
                break;
            case LoRaPacketType.SOS:
                await this.handleSOS(packet, rssi, snr);
                break;
            case LoRaPacketType.ACK:
                this.handleAck(packet);
                break;
            case LoRaPacketType.LOCATION:
                this.handleLocation(packet, rssi, snr);
                break;
            default:
                logger.debug(`Unknown packet type: ${packet.type}`);
        }

        // Relay if needed
        if (this.shouldRelay(packet)) {
            await this.relayPacket(packet);
        }
    }

    /**
     * Handle beacon packet
     */
    private handleBeacon(packet: LoRaPacket, rssi: number, snr: number): void {
        const payload = packet.payload;
        const nameLength = payload[0];
        const name = new TextDecoder().decode(payload.slice(1, 1 + nameLength));
        const capabilities = this.parseCapabilities(payload[1 + nameLength]);
        const batteryLevel = payload[2 + nameLength];

        const node: LoRaNode = {
            nodeId: packet.sourceId.toString(16),
            shortId: packet.sourceId,
            name,
            rssi,
            snr,
            distance: this.estimateDistance(rssi),
            lastSeen: Date.now(),
            hopCount: packet.hopCount,
            capabilities,
            batteryLevel,
            isRelay: capabilities.includes('relay'),
        };

        const isNew = !this.knownNodes.has(packet.sourceId);
        this.knownNodes.set(packet.sourceId, node);

        if (isNew) {
            this.stats.nodesDiscovered++;
            logger.info(`🆕 Discovered LoRa node: ${name} (${node.nodeId})`);
            this.onNodeDiscoveredCallbacks.forEach(cb => cb(node));
        }

        this.saveKnownNodes();
    }

    /**
     * Handle message packet
     */
    private async handleMessage(packet: LoRaPacket, rssi: number, snr: number): Promise<void> {
        let content = new TextDecoder().decode(packet.payload);

        // Decompress if needed
        if (packet.flags.isCompressed) {
            try {
                content = await meshCompressionService.decompress(content);
            } catch (error) {
                logger.error('Decompression failed:', error);
            }
        }

        const message: LoRaMessage = {
            id: `lora-rx-${packet.id}`,
            type: 'text',
            senderId: packet.sourceId.toString(16),
            recipientId: packet.destId === 0xFFFF ? undefined : packet.destId.toString(16),
            content,
            priority: packet.flags.priority,
            timestamp: packet.timestamp,
            ttl: CONFIG.MAX_HOPS - packet.hopCount,
        };

        // Send ACK if required
        if (packet.flags.requireAck && packet.destId === this.myNodeId) {
            await this.sendAck(packet);
        }

        logger.info(`📨 Received LoRa message from ${message.senderId}`);
        this.onMessageReceivedCallbacks.forEach(cb => cb(message));
    }

    /**
     * Handle SOS packet
     */
    private async handleSOS(packet: LoRaPacket, rssi: number, snr: number): Promise<void> {
        let content: any;
        try {
            content = JSON.parse(new TextDecoder().decode(packet.payload));
        } catch {
            content = { reason: new TextDecoder().decode(packet.payload) };
        }

        const sosMessage: LoRaMessage = {
            id: `lora-sos-${packet.id}`,
            type: 'sos',
            senderId: packet.sourceId.toString(16),
            content: content.reason || 'SOS',
            priority: 'emergency',
            timestamp: packet.timestamp,
            ttl: CONFIG.MAX_HOPS - packet.hopCount,
            position: content.position,
        };

        logger.warn(`🆘 Received SOS from ${sosMessage.senderId}: ${sosMessage.content}`);
        this.onSOSReceivedCallbacks.forEach(cb => cb(sosMessage));
    }

    /**
     * Handle ACK packet
     */
    private handleAck(packet: LoRaPacket): void {
        const originalId = new DataView(packet.payload.buffer).getUint16(0, true);

        if (this.pendingAcks.has(originalId)) {
            const pending = this.pendingAcks.get(originalId)!;
            pending.message.acked = true;
            this.pendingAcks.delete(originalId);
            logger.debug(`✅ ACK received for packet ${originalId}`);
        }
    }

    /**
     * Handle location packet
     */
    private handleLocation(packet: LoRaPacket, rssi: number, snr: number): void {
        const content = new TextDecoder().decode(packet.payload);
        const location = meshCompressionService.decompressLocation(content);

        if (location) {
            const node = this.knownNodes.get(packet.sourceId);
            if (node) {
                node.position = location;
                node.lastSeen = Date.now();
                this.knownNodes.set(packet.sourceId, node);
            }
        }
    }

    /**
     * Send ACK for a packet
     */
    private async sendAck(originalPacket: LoRaPacket): Promise<void> {
        const ackPayload = new Uint8Array(2);
        new DataView(ackPayload.buffer).setUint16(0, originalPacket.id, true);

        const ackPacket: LoRaPacket = {
            id: this.getNextPacketId(),
            type: LoRaPacketType.ACK,
            sourceId: this.myNodeId,
            destId: originalPacket.sourceId,
            flags: {
                requireAck: false,
                isRelay: false,
                isCompressed: false,
                isEncrypted: false,
                priority: 'high',
            },
            hopCount: 0,
            payload: ackPayload,
            timestamp: Date.now(),
        };

        await this.transmitPacket(ackPacket);
    }

    // ============================================================================
    // RELAY LOGIC
    // ============================================================================

    /**
     * Check if packet should be relayed
     */
    private shouldRelay(packet: LoRaPacket): boolean {
        // Don't relay our own packets
        if (packet.sourceId === this.myNodeId) return false;

        // Don't relay if max hops reached
        if (packet.hopCount >= CONFIG.MAX_HOPS) return false;

        // Don't relay ACKs
        if (packet.type === LoRaPacketType.ACK) return false;

        // Always relay SOS
        if (packet.type === LoRaPacketType.SOS) return true;

        // Relay if not addressed to us
        if (packet.destId !== 0xFFFF && packet.destId !== this.myNodeId) return true;

        return false;
    }

    /**
     * Relay a packet
     */
    private async relayPacket(packet: LoRaPacket): Promise<void> {
        const relayedPacket: LoRaPacket = {
            ...packet,
            hopCount: packet.hopCount + 1,
            flags: { ...packet.flags, isRelay: true },
        };

        // Add small delay to avoid collision
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

        await this.transmitPacket(relayedPacket);
        logger.debug(`🔄 Relayed packet ${packet.id} (hop ${relayedPacket.hopCount})`);
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private hashToShortId(id: string): number {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash) & 0xFFFF;
    }

    private getNextPacketId(): number {
        this.packetIdCounter = (this.packetIdCounter + 1) & 0xFFFF;
        return this.packetIdCounter;
    }

    private getCapabilitiesByte(): number {
        let byte = 0;
        byte |= 0x01; // GPS (placeholder)
        byte |= 0x02; // Relay
        byte |= 0x04; // Beacon
        byte |= 0x08; // SOS
        return byte;
    }

    private parseCapabilities(byte: number): LoRaCapability[] {
        const caps: LoRaCapability[] = [];
        if (byte & 0x01) caps.push('gps');
        if (byte & 0x02) caps.push('relay');
        if (byte & 0x04) caps.push('beacon');
        if (byte & 0x08) caps.push('sos');
        if (byte & 0x10) caps.push('sensor');
        if (byte & 0x20) caps.push('gateway');
        return caps;
    }

    private estimateDistance(rssi: number): number {
        // Free-space path loss model (simplified)
        // Distance = 10^((TxPower - RSSI - PathLossConstant) / (10 * n))
        const txPower = CONFIG.TX_POWER;
        const pathLossAt1m = 40; // dB
        const n = 2.5; // Path loss exponent (2 for free space, higher for obstacles)

        const distance = Math.pow(10, (txPower - rssi - pathLossAt1m) / (10 * n));
        return Math.round(distance * 100) / 100; // km with 2 decimals
    }

    private updateRssiStats(rssi: number, snr: number): void {
        const count = this.stats.packetsReceived;
        this.stats.averageRssi = ((this.stats.averageRssi * (count - 1)) + rssi) / count;
        this.stats.averageSnr = ((this.stats.averageSnr * (count - 1)) + snr) / count;
    }

    private packetToMessage(packet: LoRaPacket): LoRaMessage {
        return {
            id: `lora-${packet.id}`,
            type: 'text',
            senderId: packet.sourceId.toString(16),
            content: new TextDecoder().decode(packet.payload),
            priority: packet.flags.priority,
            timestamp: packet.timestamp,
            ttl: CONFIG.MAX_HOPS - packet.hopCount,
        };
    }

    private setModuleState(state: LoRaModuleState): void {
        if (this.moduleState !== state) {
            this.moduleState = state;
            this.onStateChangedCallbacks.forEach(cb => cb(state));
        }
    }

    private handleTransmitComplete(success: boolean): void {
        this.setModuleState('connected');
    }

    private handleModuleError(error: any): void {
        logger.error('LoRa module error:', error);
        this.setModuleState('error');
    }

    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('LoRaMeshService not initialized');
        }
    }

    // ============================================================================
    // DUTY CYCLE MANAGEMENT
    // ============================================================================

    private startDutyCycleReset(): void {
        // Reset air time budget every hour
        this.dutyCycleTimer = setInterval(() => {
            this.stats.airTimeUsedMs = 0;
            this.stats.airTimeRemainingMs = CONFIG.AIR_TIME_BUDGET_MS;
            logger.debug('Duty cycle budget reset');
        }, 3600000);
    }

    // ============================================================================
    // PERSISTENCE
    // ============================================================================

    private async saveKnownNodes(): Promise<void> {
        const data = Array.from(this.knownNodes.entries());
        await AsyncStorage.setItem(STORAGE_KEYS.KNOWN_NODES, JSON.stringify(data));
    }

    private async loadKnownNodes(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.KNOWN_NODES);
            if (data) {
                const entries = JSON.parse(data) as Array<[number, LoRaNode]>;
                this.knownNodes = new Map(entries);
                this.stats.nodesDiscovered = this.knownNodes.size;
            }
        } catch (error) {
            logger.error('Failed to load known nodes:', error);
        }
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    getModuleState(): LoRaModuleState {
        return this.moduleState;
    }

    isConnected(): boolean {
        return this.moduleState === 'connected';
    }

    getKnownNodes(): LoRaNode[] {
        return Array.from(this.knownNodes.values());
    }

    getStats(): LoRaStats {
        return { ...this.stats };
    }

    getNodeById(nodeId: string): LoRaNode | undefined {
        const shortId = this.hashToShortId(nodeId);
        return this.knownNodes.get(shortId);
    }

    // Event subscriptions
    onNodeDiscovered(callback: (node: LoRaNode) => void): () => void {
        this.onNodeDiscoveredCallbacks.push(callback);
        return () => {
            this.onNodeDiscoveredCallbacks = this.onNodeDiscoveredCallbacks.filter(cb => cb !== callback);
        };
    }

    onMessageReceived(callback: (message: LoRaMessage) => void): () => void {
        this.onMessageReceivedCallbacks.push(callback);
        return () => {
            this.onMessageReceivedCallbacks = this.onMessageReceivedCallbacks.filter(cb => cb !== callback);
        };
    }

    onSOSReceived(callback: (sos: LoRaMessage) => void): () => void {
        this.onSOSReceivedCallbacks.push(callback);
        return () => {
            this.onSOSReceivedCallbacks = this.onSOSReceivedCallbacks.filter(cb => cb !== callback);
        };
    }

    onStateChanged(callback: (state: LoRaModuleState) => void): () => void {
        this.onStateChangedCallbacks.push(callback);
        return () => {
            this.onStateChangedCallbacks = this.onStateChangedCallbacks.filter(cb => cb !== callback);
        };
    }

    // Cleanup
    async destroy(): Promise<void> {
        this.stopBeacon();

        if (this.dutyCycleTimer) {
            clearInterval(this.dutyCycleTimer);
            this.dutyCycleTimer = null;
        }

        if (this.scanTimer) {
            clearInterval(this.scanTimer);
            this.scanTimer = null;
        }

        if (this.nativeModule) {
            await this.nativeModule.shutdown?.();
        }

        if (this.eventEmitter) {
            this.eventEmitter.removeAllListeners('onPacketReceived');
            this.eventEmitter.removeAllListeners('onTransmitComplete');
            this.eventEmitter.removeAllListeners('onModuleError');
        }

        this.onNodeDiscoveredCallbacks = [];
        this.onMessageReceivedCallbacks = [];
        this.onSOSReceivedCallbacks = [];
        this.onStateChangedCallbacks = [];

        this.isInitialized = false;
        logger.info('📴 LoRaMeshService destroyed');
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const loraMeshService = new LoRaMeshService();
export default loraMeshService;
