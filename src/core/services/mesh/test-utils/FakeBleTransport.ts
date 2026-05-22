/**
 * FAKE BLE TRANSPORT — B0 MESH TEST SCAFFOLD
 *
 * Deterministic in-memory replacement for HighPerformanceBle.
 * Designed for use in Jest test files only — never imported by production code.
 *
 * Design decisions:
 * - No real timers by default (all delivery is synchronous-on-tick).
 * - Virtual clock controlled by the harness via advanceClock().
 * - Each FakeBleNode simulates one physical device: it has an ID, can
 *   "scan" and discover neighbours that are in its visible set, and can
 *   GATT-connect to them.
 * - Message delivery between nodes is mediated by a shared FakeBleNetwork
 *   bus, so tests can inspect all in-flight frames.
 *
 * Limitations (documented honestly):
 * - MTU negotiation is fixed at 185 bytes (MAX_CHUNK_SIZE from constants).
 * - RSSI values are synthetic (distance model not implemented).
 * - Concurrency model is single-threaded (Promise.resolve micro-tasks),
 *   not true async; real BLE has OS-level concurrency gaps not modelled.
 * - Advertisement broadcast path (updateAdvertisementData) is tracked but
 *   not forwarded to other nodes — advertisement scanning is simulated via
 *   direct "scan discovery" without parsing actual advertising frames.
 * - Connection teardown race conditions are not modelled.
 */

import { Buffer } from 'buffer';

// ---- Types mirroring the production BLE layer ----

export interface FakeBlePeer {
  id: string;
  rssi: number;
  manufacturerData?: string;
  lastSeen: number;
}

export type IncomingDataCallback = (
  deviceId: string,
  charUUID: string,
  data: Buffer,
) => void;

export type PeerFoundCallback = (peer: FakeBlePeer) => void;

// ---- Stats collected per node for assertion ----

export interface NodeStats {
  /** Total individual GATT write calls that succeeded */
  gattWritesSent: number;
  /** Total GATT notify calls to inbound clients */
  gattNotificationsSent: number;
  /** Total frames received via GATT write or notification */
  framesReceived: number;
  /** Advertisement data updates */
  advertisementUpdates: number;
}

// ---- Shared network bus ----

/**
 * FakeBleNetwork is shared by all FakeBleNode instances in a test.
 * It owns:
 *  - The topology (which nodes can see/reach which).
 *  - The virtual clock.
 *  - A log of every in-flight packet for assertion.
 */
export class FakeBleNetwork {
  /** All registered nodes indexed by their ID */
  private readonly nodes = new Map<string, FakeBleNode>();

  /** Adjacency list — nodeId -> Set of directly reachable nodeIds */
  private readonly topology = new Map<string, Set<string>>();

  /** Virtual milliseconds elapsed since network creation */
  private _now = 0;

  /** Log of every frame that traversed the bus — (fromId, toId, charUUID, data) */
  readonly frameLog: Array<{
    fromId: string;
    toId: string;
    charUUID: string;
    data: Buffer;
    at: number;
  }> = [];

  get now(): number {
    return this._now;
  }

  /** Advance the virtual clock by `ms` milliseconds (for TTL / timeout logic). */
  advanceClock(ms: number): void {
    this._now += ms;
  }

  registerNode(node: FakeBleNode): void {
    this.nodes.set(node.nodeId, node);
    if (!this.topology.has(node.nodeId)) {
      this.topology.set(node.nodeId, new Set());
    }
  }

  /**
   * Connect two nodes bidirectionally in the topology.
   * Any frame sent by A will be received by B and vice versa.
   */
  link(aId: string, bId: string): void {
    if (!this.topology.has(aId)) this.topology.set(aId, new Set());
    if (!this.topology.has(bId)) this.topology.set(bId, new Set());
    this.topology.get(aId)!.add(bId);
    this.topology.get(bId)!.add(aId);
  }

  /**
   * Get nodes directly reachable from `fromId`.
   * Returns the actual FakeBleNode instances.
   */
  getNeighbours(fromId: string): FakeBleNode[] {
    const neighbourIds = this.topology.get(fromId) ?? new Set<string>();
    const result: FakeBleNode[] = [];
    for (const id of neighbourIds) {
      const node = this.nodes.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Deliver a frame from `fromId` to `toId` via GATT.
   * Called by FakeBleNode.writeToCharacteristic and notifyGATTClients.
   */
  deliverFrame(
    fromId: string,
    toId: string,
    charUUID: string,
    data: Buffer,
  ): void {
    this.frameLog.push({ fromId, toId, charUUID, data, at: this._now });
    const target = this.nodes.get(toId);
    if (!target) return;
    target._receiveFrame(fromId, charUUID, data);
  }

  /** Total unique nodes that received at least one frame. */
  deliveryReach(): Set<string> {
    const reached = new Set<string>();
    for (const entry of this.frameLog) {
      reached.add(entry.toId);
    }
    return reached;
  }

  /** Total frame count across all edges */
  totalFrames(): number {
    return this.frameLog.length;
  }
}

// ---- Per-node fake ----

/**
 * FakeBleNode implements the same public API surface as HighPerformanceBle
 * that MeshNetworkService calls, backed entirely by in-memory state.
 *
 * Usage: construct, register with a FakeBleNetwork, link with neighbours,
 * then pass the node's `.transport` getter as the injected transport in
 * MeshNetworkService tests (or use jest module mocking to replace the singleton).
 */
export class FakeBleNode {
  readonly nodeId: string;
  readonly network: FakeBleNetwork;
  readonly stats: NodeStats = {
    gattWritesSent: 0,
    gattNotificationsSent: 0,
    framesReceived: 0,
    advertisementUpdates: 0,
  };

  private _bluetoothOn = true;
  private _peerFoundListeners: PeerFoundCallback[] = [];
  private _incomingDataListeners: IncomingDataCallback[] = [];

  /** GATT outbound connections (IDs of nodes this node connected TO) */
  private _outboundConnections = new Set<string>();

  /** GATT inbound connections (IDs of nodes that connected TO this node) */
  private _inboundConnections = new Set<string>();

  /** Simulated MTU per outbound peer — fixed for now */
  private readonly _mtu: number;

  /** Last advertisement data written by this node */
  private _lastAdvertisementHex: string | null = null;

  constructor(nodeId: string, network: FakeBleNetwork, mtu = 185) {
    this.nodeId = nodeId;
    this.network = network;
    this._mtu = mtu;
    network.registerNode(this);
  }

  // ---- Bluetooth state ----

  setBluetoothOn(on: boolean): void {
    this._bluetoothOn = on;
  }

  async isBluetoothPoweredOn(): Promise<boolean> {
    return this._bluetoothOn;
  }

  async getMeshAvailabilityReason(): Promise<
    'no-permission' | 'bluetooth-off' | 'unsupported' | null
  > {
    if (!this._bluetoothOn) return 'bluetooth-off';
    return null;
  }

  // ---- Dual mode (no-op in fake — discovery is topology-driven) ----

  async startDualMode(): Promise<void> {
    // Trigger peer discovery synchronously for all linked neighbours
    this._discoverNeighbours();
  }

  async stopDualMode(): Promise<void> {
    this._outboundConnections.clear();
    this._inboundConnections.clear();
  }

  // ---- Peer found listeners (mirrors HighPerformanceBle.onPeerFound) ----

  onPeerFound(callback: PeerFoundCallback): void {
    this._peerFoundListeners.push(callback);
  }

  removePeerFoundListener(callback: PeerFoundCallback): void {
    this._peerFoundListeners = this._peerFoundListeners.filter(
      (l) => l !== callback,
    );
  }

  // ---- Incoming data listeners ----

  onIncomingData(callback: IncomingDataCallback): () => void {
    this._incomingDataListeners.push(callback);
    return () => {
      this._incomingDataListeners = this._incomingDataListeners.filter(
        (l) => l !== callback,
      );
    };
  }

  // ---- GATT client: outbound connections ----

  async connectToPeer(peerId: string): Promise<boolean> {
    if (!this._bluetoothOn) return false;
    const neighbour = this.network.getNeighbours(this.nodeId).find(
      (n) => n.nodeId === peerId,
    );
    if (!neighbour) return false;
    this._outboundConnections.add(peerId);
    neighbour._inboundConnections.add(this.nodeId);
    return true;
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this._outboundConnections);
  }

  getConnectedPeerCount(): number {
    return this._outboundConnections.size;
  }

  getUnconnectedDiscoveredPeerIds(): string[] {
    return this.network
      .getNeighbours(this.nodeId)
      .filter(
        (n) =>
          !this._outboundConnections.has(n.nodeId) &&
          n.nodeId !== this.nodeId,
      )
      .map((n) => n.nodeId);
  }

  getPeerMTU(_peerId: string): number {
    return this._mtu;
  }

  // ---- GATT write (outbound to peer's GATT server) ----

  async writeToCharacteristic(
    deviceId: string,
    charUUID: string,
    data: Buffer,
  ): Promise<boolean> {
    if (!this._outboundConnections.has(deviceId)) return false;
    this.stats.gattWritesSent++;
    this.network.deliverFrame(this.nodeId, deviceId, charUUID, data);
    return true;
  }

  // ---- GATT server: inbound clients ----

  getGATTServerClientCount(): number {
    return this._inboundConnections.size;
  }

  notifyGATTClients(charUUID: string, data: Buffer): void {
    for (const clientId of this._inboundConnections) {
      this.stats.gattNotificationsSent++;
      this.network.deliverFrame(this.nodeId, clientId, charUUID, data);
    }
  }

  // ---- Advertisement ----

  updateAdvertisementData(data: Buffer): void {
    this.stats.advertisementUpdates++;
    this._lastAdvertisementHex = data.toString('hex');
  }

  getLastAdvertisement(): Buffer | null {
    if (!this._lastAdvertisementHex) return null;
    return Buffer.from(this._lastAdvertisementHex, 'hex');
  }

  // ---- Internal: receive a frame from the network bus ----

  /** Called by FakeBleNetwork.deliverFrame when a frame is routed to this node. */
  _receiveFrame(fromId: string, charUUID: string, data: Buffer): void {
    this.stats.framesReceived++;
    for (const listener of [...this._incomingDataListeners]) {
      listener(fromId, charUUID, data);
    }
  }

  // ---- Internal: synchronously discover all topology neighbours ----

  private _discoverNeighbours(): void {
    const neighbours = this.network.getNeighbours(this.nodeId);
    for (const neighbour of neighbours) {
      const peer: FakeBlePeer = {
        id: neighbour.nodeId,
        rssi: -60,
        lastSeen: this.network.now,
      };
      for (const listener of [...this._peerFoundListeners]) {
        listener(peer);
      }
    }
  }
}
