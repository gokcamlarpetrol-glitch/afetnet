import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma';
import {
    sanitizeSocketData,
    validateLocationUpdate,
    validateMeshRelay,
    validateMessageSend,
    validateSosSend,
} from '../utils/socketValidation';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  afnId?: string;
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        id: string;
        afnId: string;
      };

      socket.userId = decoded.id;
      socket.afnId = decoded.afnId;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ User connected: ${socket.afnId} (${socket.id})`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    socket.join(`afn:${socket.afnId}`);

    // Update last seen
    prisma.user.update({
      where: { id: socket.userId },
      data: { lastSeenAt: new Date() },
    }).catch(console.error);

    // ==================== LOCATION UPDATES ====================
    
    socket.on('location:update', async (rawData: any) => {
      try {
        // CRITICAL: Validate input
        if (!validateLocationUpdate(rawData)) {
          socket.emit('error', { message: 'Invalid location data' });
          return;
        }

        const data = sanitizeSocketData(rawData);
        // Save location history
        await prisma.locationHistory.create({
          data: {
            userId: socket.userId!,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            source: data.source || 'gps',
          },
        });

        // Broadcast to family members
        const familyMembers = await prisma.familyMember.findMany({
          where: { userId: socket.userId! },
          select: { memberAfnId: true },
        });

        familyMembers.forEach((member: { memberAfnId: string }) => {
          io.to(`afn:${member.memberAfnId}`).emit('family:location', {
            afnId: socket.afnId,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error('Location update error:', error);
      }
    });

    // ==================== MESSAGES ====================
    
    socket.on('message:send', async (rawData: any) => {
      try {
        // CRITICAL: Validate input
        if (!validateMessageSend(rawData)) {
          socket.emit('message:error', { error: 'Invalid message data' });
          return;
        }

        const data = sanitizeSocketData(rawData);
        // Find receiver
        const receiver = await prisma.user.findUnique({
          where: { afnId: data.receiverAfnId },
        });

        if (!receiver) {
          socket.emit('message:error', { error: 'Receiver not found' });
          return;
        }

        // Save message
        const message = await prisma.message.create({
          data: {
            senderId: socket.userId!,
            receiverId: receiver.id,
            content: data.content,
            type: data.type || 'text',
            latitude: data.latitude,
            longitude: data.longitude,
            isSent: true,
            isDelivered: false,
          },
        });

        // Send to receiver
        io.to(`user:${receiver.id}`).emit('message:received', {
          id: message.id,
          senderAfnId: socket.afnId,
          content: message.content,
          type: message.type,
          latitude: message.latitude,
          longitude: message.longitude,
          timestamp: message.createdAt,
        });

        // Confirm to sender
        socket.emit('message:sent', {
          id: message.id,
          status: 'delivered',
        });

        // Mark as delivered
        await prisma.message.update({
          where: { id: message.id },
          data: { isDelivered: true },
        });
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    // ==================== SOS ALERTS ====================
    
    socket.on('sos:send', async (rawData: any) => {
      try {
        // CRITICAL: Validate input
        if (!validateSosSend(rawData)) {
          socket.emit('sos:error', { error: 'Invalid SOS data' });
          return;
        }

        const data = sanitizeSocketData(rawData);
        // Create SOS alert
        const sosAlert = await prisma.sosAlert.create({
          data: {
            userId: socket.userId!,
            latitude: data.latitude,
            longitude: data.longitude,
            message: data.message,
            tags: data.tags || ['sos'],
            status: 'active',
            priority: 'critical',
          },
        });

        // Broadcast to all connected users
        io.emit('sos:alert', {
          id: sosAlert.id,
          afnId: socket.afnId,
          latitude: sosAlert.latitude,
          longitude: sosAlert.longitude,
          message: sosAlert.message,
          tags: sosAlert.tags,
          timestamp: sosAlert.createdAt,
        });

        // Notify family members
        const familyMembers = await prisma.familyMember.findMany({
          where: { userId: socket.userId! },
          include: { user: { include: { fcmTokens: true } } },
        });

        // Send push notifications to family
        const { sendMulticastNotification } = await import('./firebase');
        const tokens = familyMembers.flatMap((m: any) => 
          m.user.fcmTokens.map((t: { token: string }) => t.token)
        );

        if (tokens.length > 0) {
          await sendMulticastNotification(tokens, {
            title: '🆘 Acil Durum!',
            body: `${socket.afnId} yardım istiyor!`,
            data: {
              type: 'sos',
              sosId: sosAlert.id,
              afnId: socket.afnId!,
              latitude: sosAlert.latitude.toString(),
              longitude: sosAlert.longitude.toString(),
            },
          });
        }

        console.log(`🚨 SOS Alert from ${socket.afnId}`);
      } catch (error) {
        console.error('SOS send error:', error);
        socket.emit('sos:error', { error: 'Failed to send SOS' });
      }
    });

    // ==================== MESH RELAY ====================
    
    socket.on('mesh:relay', async (rawData: any) => {
      try {
        // CRITICAL: Validate input
        if (!validateMeshRelay(rawData)) {
          socket.emit('error', { message: 'Invalid mesh data' });
          return;
        }

        const data = sanitizeSocketData(rawData);
        // Save mesh message
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour
        
        await prisma.meshMessage.create({
          data: {
            meshId: data.meshId,
            fromAfnId: socket.afnId!,
            toAfnId: data.toAfnId,
            type: data.type,
            payload: data.payload,
            ttl: data.ttl,
            hopCount: 0,
            relayedBy: [],
            expiresAt,
          },
        });

        // Relay to target or broadcast
        if (data.toAfnId) {
          io.to(`afn:${data.toAfnId}`).emit('mesh:message', data);
        } else {
          socket.broadcast.emit('mesh:message', data);
        }
      } catch (error) {
        console.error('Mesh relay error:', error);
      }
    });

    // ==================== TYPING INDICATOR ====================
    
    socket.on('typing:start', (data: { receiverAfnId: string }) => {
      io.to(`afn:${data.receiverAfnId}`).emit('typing:indicator', {
        afnId: socket.afnId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data: { receiverAfnId: string }) => {
      io.to(`afn:${data.receiverAfnId}`).emit('typing:indicator', {
        afnId: socket.afnId,
        isTyping: false,
      });
    });

    // ==================== DISCONNECT ====================
    
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.afnId} (${socket.id})`);
      
      // Update last seen
      prisma.user.update({
        where: { id: socket.userId },
        data: { lastSeenAt: new Date() },
      }).catch(console.error);
    });
  });

  console.log('✅ Socket.IO handlers configured');
};
