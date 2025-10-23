import { Logger } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

export const SOCKET_IO_PROVIDER = 'SOCKET_IO_CLIENT';

const logger = new Logger('SocketIOProvider');

let socketInstance: Socket | null = null;

export const socketIOProvider = {
  provide: SOCKET_IO_PROVIDER,
  useFactory: async () => {
    if (socketInstance && socketInstance.connected) {
      return socketInstance;
    }

    const socketUrl = process.env.REALTIME_SERVICE_URL || 'http://realtime-service:5009';
    
    logger.log(`Connecting to Socket.IO at ${socketUrl}`);
    
    socketInstance = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    return new Promise((resolve, reject) => {
      socketInstance!.on('connect', () => {
        logger.log('✅ Connected to Socket.IO server');
        resolve(socketInstance);
      });

      socketInstance!.on('connect_error', (error) => {
        logger.error('❌ Socket.IO connection error:', error);
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Socket.IO connection timeout'));
      }, 10000);
    });
  },
};
