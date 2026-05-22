'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WsTransactionUpdate, WsAgentReasoning } from '../lib/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type EventHandlers = {
  onTransactionUpdate?: (data: WsTransactionUpdate) => void;
  onAgentReasoning?: (data: WsAgentReasoning) => void;
  onAgentError?: (data: { txnId: string; error: string }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function useWebSocket(handlers: EventHandlers) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref fresh without reconnecting
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('gt_token') : null;

    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.info('[GhostTrace WS] Connected:', socket.id);
      handlersRef.current.onConnected?.();
    });

    socket.on('disconnect', (reason) => {
      console.warn('[GhostTrace WS] Disconnected:', reason);
      handlersRef.current.onDisconnected?.();
    });

    socket.on('connect_error', (err) => {
      console.error('[GhostTrace WS] Connection error:', err.message);
    });

    socket.on('transaction:update', (data: WsTransactionUpdate) => {
      handlersRef.current.onTransactionUpdate?.(data);
    });

    socket.on('agent:reasoning', (data: WsAgentReasoning) => {
      handlersRef.current.onAgentReasoning?.(data);
    });

    socket.on('agent:error', (data: { txnId: string; error: string }) => {
      handlersRef.current.onAgentError?.(data);
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  return {
    isConnected: () => socketRef.current?.connected ?? false,
    socket: socketRef.current,
  };
}
