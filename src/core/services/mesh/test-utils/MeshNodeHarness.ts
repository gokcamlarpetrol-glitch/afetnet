/**
 * MESH NODE HARNESS — B0 MESH TEST SCAFFOLD
 *
 * Orchestrator that:
 *  1. Spins up N FakeBleNode instances in a named topology.
 *  2. Wires each node to a stripped-down relay loop that mirrors
 *     MeshNetworkService's packet relay logic (TTL-dec + dedup + rebroadcast).
 *  3. Provides inject() to push a packet into a source node.
 *  4. Exposes metrics for assertion: delivery set, hop counts, dedup hits.
 *
 * The relay loop is implemented INSIDE the harness (not via MeshNetworkService)
 * so that the scaffold tests remain independent of MeshNetworkService internals
 * and can verify protocol-level behaviour (M3 relay-storm, M5 dedup, M9 chunks)
 * in isolation.
 *
 * When MeshNetworkService is the SUT, tests inject a FakeBleNode as the
 * transport via jest.mock (see MeshScaffold.test.ts for the pattern).
 */

import { Buffer } from 'buffer';
import {
  MeshProtocol,
  MeshMessageType,
  MeshPacket,
} from '../MeshProtocol';
import { FakeBleNetwork, FakeBleNode } from './FakeBleTransport';
import { AFETNET_CHAR_MSG_UUID } from '../../../ble/constants';

// ---- Topology helpers ----

/**
 * Build a LINE topology: node[0] — node[1] — node[2] — ... — node[N-1]
 * Each node is only linked to its immediate neighbours.
 */
export function buildLineTopology(
  network: FakeBleNetwork,
  count: number,
): FakeBleNode[] {
  const nodes: FakeBleNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(new FakeBleNode(`node-${i}`, network));
  }
  for (let i = 0; i < nodes.length - 1; i++) {
    network.link(nodes[i].nodeId, nodes[i + 1].nodeId);
  }
  return nodes;
}

/**
 * Build a STAR topology: one hub node linked to all leaf nodes.
 * hub = nodes[0], leaves = nodes[1..N-1]
 */
export function buildStarTopology(
  network: FakeBleNetwork,
  leafCount: number,
): FakeBleNode[] {
  const hub = new FakeBleNode('hub', network);
  const nodes: FakeBleNode[] = [hub];
  for (let i = 0; i < leafCount; i++) {
    const leaf = new FakeBleNode(`leaf-${i}`, network);
    nodes.push(leaf);
    network.link(hub.nodeId, leaf.nodeId);
  }
  return nodes;
}

/**
 * Build a DENSE MESH (fully connected graph) — every node is linked to every
 * other node. Simulates a crowd scenario where relay-storm risk is highest.
 */
export function buildDenseMesh(
  network: FakeBleNetwork,
  count: number,
): FakeBleNode[] {
  const nodes: FakeBleNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push(new FakeBleNode(`dense-${i}`, network));
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      network.link(nodes[i].nodeId, nodes[j].nodeId);
    }
  }
  return nodes;
}

// ---- Metrics collected per run ----

export interface HarnessMetrics {
  /** Number of nodes that received the injected message (excluding source) */
  nodesReached: number;
  /** Node IDs of nodes that received the message */
  reachedNodeIds: Set<string>;
  /** Total relay frames transmitted across all edges (includes re-transmissions) */
  totalRelayFrames: number;
  /** Number of times a packet was dropped because it was already seen (dedup hits) */
  dedupDrops: number;
  /** Number of times a packet was dropped due to TTL exhaustion */
  ttlDrops: number;
  /**
   * Per-node hop counts — how many relay hops before a given node received
   * the first copy. 0 = source node itself.
   */
  hopCounts: Map<string, number>;
}

// ---- Harness ----

/**
 * MeshNodeHarness connects FakeBleNodes together, runs a relay loop,
 * and collects metrics.
 *
 * The relay logic faithfully mirrors MeshNetworkService:
 *  - Seen-ID deduplication (LRU not needed at test scale — a plain Set works).
 *  - TTL decrement: drop if TTL reaches 0.
 *  - Re-broadcast via GATT write to all connected peers AND notify inbound clients.
 */
export class MeshNodeHarness {
  private readonly nodes: FakeBleNode[];
  private readonly network: FakeBleNetwork;

  /** seenIds per node — mirrors MeshNetworkService.seenMessageIds */
  private readonly seenIds = new Map<string, Set<string>>();

  /** hop count at which each node first received the message */
  private readonly hopCounts = new Map<string, number>();

  /** Nodes that received the message at least once */
  private readonly receivedNodeIds = new Set<string>();

  private dedupDrops = 0;
  private ttlDrops = 0;

  /** All relay frames queued for processing in the current tick */
  private pendingRelay: Array<{
    sourceNodeId: string;
    fromDeviceId: string;
    charUUID: string;
    data: Buffer;
    hopDepth: number;
  }> = [];

  constructor(nodes: FakeBleNode[], network: FakeBleNetwork) {
    this.nodes = nodes;
    this.network = network;

    for (const node of nodes) {
      this.seenIds.set(node.nodeId, new Set());
    }
  }

  /**
   * Establish all GATT connections as defined by the topology,
   * and register incoming-data relay handlers on each node.
   *
   * Must be called before inject().
   */
  async setup(): Promise<void> {
    // Trigger peer discovery on all nodes (synchronous in FakeBleNode.startDualMode)
    for (const node of this.nodes) {
      await node.startDualMode();
    }

    // Connect each node to all its discovered neighbours
    for (const node of this.nodes) {
      const neighbours = this.network.getNeighbours(node.nodeId);
      for (const neighbour of neighbours) {
        await node.connectToPeer(neighbour.nodeId);
      }
    }

    // Register relay handlers
    for (const node of this.nodes) {
      node.onIncomingData((fromDeviceId, charUUID, data) => {
        this._handleIncoming(node.nodeId, fromDeviceId, charUUID, data);
      });
    }
  }

  /**
   * Inject a serialised MeshProtocol packet into `sourceNodeId`.
   * The harness then synchronously propagates relay frames until
   * no more pending work exists.
   *
   * @returns collected metrics after full propagation
   */
  async inject(
    sourceNodeId: string,
    type: MeshMessageType,
    payload: Buffer,
    ttl: number,
    messageId?: number,
  ): Promise<HarnessMetrics> {
    // Reset per-run METRICS only — seenIds are intentionally preserved across
    // inject() calls so that a second call with the same messageId correctly
    // triggers dedup-drops (mirrors real node memory).
    // Call resetSeenIds() before inject() if you explicitly want a fresh slate.
    this.hopCounts.clear();
    this.receivedNodeIds.clear();
    this.dedupDrops = 0;
    this.ttlDrops = 0;
    this.pendingRelay = [];

    const sourceNode = this.nodes.find((n) => n.nodeId === sourceNodeId);
    if (!sourceNode) {
      throw new Error(`Source node ${sourceNodeId} not found in harness`);
    }

    // Mark source as hop-0
    this.hopCounts.set(sourceNodeId, 0);

    // Serialize and broadcast from source
    const serialized = MeshProtocol.serialize(
      type,
      sourceNodeId,
      payload,
      ttl,
      100,
      messageId,
    );

    // Mark message as seen by source — use the same key format as _processRelayItem.
    // We deserialize the just-serialized packet to get the exact header values
    // (messageId may be auto-generated inside MeshProtocol.serialize if not provided).
    const sourcePacket = MeshProtocol.deserialize(serialized);
    const sourceMsgKey = sourcePacket
      ? `${sourcePacket.header.messageId.toString(16)}-${sourcePacket.header.sourceId}`
      : (messageId?.toString(16) ?? '');
    this.seenIds.get(sourceNodeId)!.add(sourceMsgKey);

    // Broadcast to all outbound peers
    const outboundPeers = sourceNode.getConnectedPeerIds();
    for (const peerId of outboundPeers) {
      await sourceNode.writeToCharacteristic(
        peerId,
        AFETNET_CHAR_MSG_UUID,
        serialized,
      );
    }
    // Notify inbound clients
    if (sourceNode.getGATTServerClientCount() > 0) {
      sourceNode.notifyGATTClients(AFETNET_CHAR_MSG_UUID, serialized);
    }

    // Drain the relay queue synchronously
    await this._drainRelay();

    return this._collectMetrics(sourceNodeId);
  }

  // ---- Internal relay engine ----

  private _handleIncoming(
    receiverNodeId: string,
    fromDeviceId: string,
    charUUID: string,
    data: Buffer,
  ): void {
    this.pendingRelay.push({
      sourceNodeId: receiverNodeId,
      fromDeviceId,
      charUUID,
      data,
      hopDepth: -1, // resolved during processing
    });
  }

  private async _drainRelay(): Promise<void> {
    // Process up to 10000 relay events before giving up (storm guard)
    let iterations = 0;
    while (this.pendingRelay.length > 0 && iterations < 10000) {
      iterations++;
      const batch = [...this.pendingRelay];
      this.pendingRelay = [];

      for (const item of batch) {
        await this._processRelayItem(item);
      }
    }
  }

  private async _processRelayItem(item: {
    sourceNodeId: string;
    fromDeviceId: string;
    charUUID: string;
    data: Buffer;
    hopDepth: number;
  }): Promise<void> {
    const { sourceNodeId, data } = item;

    const packet = MeshProtocol.deserialize(data);
    if (!packet) return; // malformed — drop silently

    const msgKey = `${packet.header.messageId.toString(16)}-${packet.header.sourceId}`;
    const seen = this.seenIds.get(sourceNodeId)!;

    // Dedup check
    if (seen.has(msgKey)) {
      this.dedupDrops++;
      return;
    }
    seen.add(msgKey);

    // Record reception (first time this node sees it)
    if (!this.receivedNodeIds.has(sourceNodeId)) {
      this.receivedNodeIds.add(sourceNodeId);
      // Infer hop depth from TTL reduction (original TTL unknown; use relayDepth)
      // Simple approximation: sender TTL - received TTL
      const originalTtl = packet.header.ttl + (this.hopCounts.get(item.fromDeviceId) ?? 0);
      this.hopCounts.set(sourceNodeId, originalTtl - packet.header.ttl);
    }

    // TTL check before relay
    if (packet.header.ttl <= 1) {
      this.ttlDrops++;
      return;
    }

    // Decrement TTL for relay
    const relayPacket = this._decrementTTL(packet, data);
    const receiverNode = this.nodes.find((n) => n.nodeId === sourceNodeId);
    if (!receiverNode) return;

    // Relay to all outbound peers (excluding the one who sent it to us)
    for (const peerId of receiverNode.getConnectedPeerIds()) {
      if (peerId === item.fromDeviceId) continue; // don't send back
      await receiverNode.writeToCharacteristic(
        peerId,
        AFETNET_CHAR_MSG_UUID,
        relayPacket,
      );
    }

    // Relay to all inbound clients (excluding sender)
    if (receiverNode.getGATTServerClientCount() > 0) {
      receiverNode.notifyGATTClients(AFETNET_CHAR_MSG_UUID, relayPacket);
    }
  }

  /**
   * Decrement TTL by 1 in the serialized binary packet.
   * TTL is at byte offset 3 in the V2 MeshProtocol header.
   */
  private _decrementTTL(packet: MeshPacket, rawData: Buffer): Buffer {
    // Re-serialize with TTL - 1
    return MeshProtocol.serialize(
      packet.header.type,
      packet.header.sourceId,
      packet.payload,
      Math.max(0, packet.header.ttl - 1),
      packet.header.qScore,
      packet.header.messageId,
    );
  }

  private _collectMetrics(sourceNodeId: string): HarnessMetrics {
    // Exclude source node from "reached" count
    const reachedExcludingSource = new Set<string>(this.receivedNodeIds);
    reachedExcludingSource.delete(sourceNodeId);

    return {
      nodesReached: reachedExcludingSource.size,
      reachedNodeIds: reachedExcludingSource,
      totalRelayFrames: this.network.totalFrames(),
      dedupDrops: this.dedupDrops,
      ttlDrops: this.ttlDrops,
      hopCounts: new Map(this.hopCounts),
    };
  }

  /** Reset frame log between multiple inject() calls in the same test */
  resetFrameLog(): void {
    this.network.frameLog.splice(0, this.network.frameLog.length);
  }

  /**
   * Explicitly clear the seen-message-ID sets on all nodes.
   * Use this before inject() ONLY when you want a completely fresh
   * deduplication state (e.g. testing different messages independently).
   * Do NOT call between two inject() calls for the same messageId if you
   * are testing dedup — seenIds must persist for the dedup assertion to hold.
   */
  resetSeenIds(): void {
    for (const seenSet of this.seenIds.values()) {
      seenSet.clear();
    }
  }

  getNode(id: string): FakeBleNode | undefined {
    return this.nodes.find((n) => n.nodeId === id);
  }
}
