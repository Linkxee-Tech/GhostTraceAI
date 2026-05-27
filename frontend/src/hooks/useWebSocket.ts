"use client";

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken, getWebSocketUrl } from '../lib/authSession';
import type { WsTransactionUpdate, WsAgentReasoning } from '../lib/types';

type EventHandlers = {
  onTransactionUpdate?: (data: WsTransactionUpdate) => void;
  onAgentReasoning?: (data: WsAgentReasoning) => void;
  onAgentError?: (data: { txnId: string; error: string }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

export function useWebSocket(handlers: EventHandlers, enabled = true) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  const manualDisconnectRef = useRef(false);

  // Keep handlers ref fresh without reconnecting
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = getToken();
    if (!token) return;

    manualDisconnectRef.current = false;
    const wsUrl = getWebSocketUrl();
    socketRef.current = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
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
      if (manualDisconnectRef.current) {
        console.debug('[GhostTrace WS] Disconnected (cleanup):', reason);
      } else if (reason === 'io client disconnect' || reason === 'transport close') {
        console.info('[GhostTrace WS] Disconnected:', reason);
      } else {
        console.warn('[GhostTrace WS] Disconnected:', reason);
      }
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
    if (!enabled) return;
    connect();
    return () => {
      if (socketRef.current) {
        manualDisconnectRef.current = true;
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, enabled]);

  return {
    isConnected: () => socketRef.current?.connected ?? false,
    socket: socketRef.current,
  };
}
