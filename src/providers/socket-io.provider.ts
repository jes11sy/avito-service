import { Logger } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

export const SOCKET_IO_PROVIDER = 'SOCKET_IO_CLIENT';

const logger = new Logger('SocketIOProvider');

class SocketIOWrapper {
  private socketInstance: Socket | null = null;
  private connecting = false;

  async getSocket(): Promise<Socket> {
    if (this.socketInstance && this.socketInstance.connected) {
      return this.socketInstance;
    }

    if (this.connecting) {
      // Wait for connection attempt to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.socketInstance && this.socketInstance.connected) {
            clearInterval(checkInterval);
            resolve(this.socketInstance!);
          }
        }, 100);
      });
    }

    this.connecting = true;
    const socketUrl = process.env.REALTIME_SERVICE_URL || 'http://realtime-service:5009';
    
    logger.log(`Connecting to Socket.IO at ${socketUrl}`);
    
    try {
      this.socketInstance = io(socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      return new Promise((resolve) => {
        const connectHandler = () => {
          logger.log('✅ Connected to Socket.IO server');
          this.socketInstance!.off('connect', connectHandler);
          this.socketInstance!.off('connect_error', errorHandler);
          this.connecting = false;
          resolve(this.socketInstance!);
        };

        const errorHandler = (error: any) => {
          logger.warn('⚠️ Socket.IO connection error (will retry):', error?.message || error);
          this.connecting = false;
          // Don't reject, just return disconnected socket
          resolve(this.socketInstance!);
        };

        this.socketInstance!.on('connect', connectHandler);
        this.socketInstance!.on('connect_error', errorHandler);
      });
    } catch (error) {
      logger.error('Error creating Socket.IO client:', error);
      this.connecting = false;
      throw error;
    }
  }

  emit(event: string, data?: any) {
    if (this.socketInstance && this.socketInstance.connected) {
      this.socketInstance.emit(event, data);
    } else {
      logger.warn(`Socket.IO not connected, dropping event: ${event}`);
    }
  }
}

const socketIOWrapper = new SocketIOWrapper();

export const socketIOProvider = {
  provide: SOCKET_IO_PROVIDER,
  useValue: socketIOWrapper,
};
