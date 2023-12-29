import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WebSocket, { WebSocketServer } from 'ws';
import { Exot } from '../../lib/index.js';
import { adapter } from '../../lib/adapters/node.js';
import { ExotWebSocket } from '../../lib/websocket.js';
import { ContextInterface } from '../../lib/types.js';

describe('NodeAdapter', () => {
  describe('WebSockets', () => {
    let exot: Exot;
    let url: string;
    let onServerBeforeUpgrade: (ctx: ContextInterface) => void;
    let onServerClose: (ws: ExotWebSocket<any>) => void;
    let onServerDrain: (ws: ExotWebSocket<any>) => void;
    let onServerError: (ws: ExotWebSocket<any>) => void;
    let onServerMessage: (ws: ExotWebSocket<any>, data: any) => void;
    let onServerOpen: (ws: ExotWebSocket<any>) => void;

    afterEach(async () => {
      if (exot) {
        await exot.close();
      }
    });

    beforeEach(async () => {
      onServerBeforeUpgrade = vi.fn();
      onServerClose = vi.fn();
      onServerDrain = vi.fn();
      onServerError = vi.fn();
      onServerMessage = vi.fn((ws, data) => {
        ws.send(JSON.stringify({ data: String(data) }));
      });
      onServerOpen = vi.fn();
      exot = new Exot()
        .adapter(adapter({
          wss: new WebSocketServer({
            noServer: true,
          }),
        }))
        .ws('/ws', {
          beforeUpgrade: onServerBeforeUpgrade,
          close: onServerClose,
          drain: onServerDrain, // not implemented in `ws`
          error: onServerError,
          open: onServerOpen,
          message: onServerMessage,
        });
      const port = await exot.listen(0);
      url = `ws://localhost:${port}/ws`;
    });

    it('should call beforeUpgrade function on the server', async () => {
      const ws = new WebSocket(url);
      await new Promise((resolve) => {
        ws.onopen = () => {
          expect(onServerBeforeUpgrade).toHaveBeenCalled();
          ws.close();
          resolve(void 0);
        };
      });
    });

    it('should call open and close functions on the server', async () => {
      const ws = new WebSocket(url);
      await new Promise((resolve) => {
        ws.onopen = () => {
          expect(onServerOpen).toHaveBeenCalled();
          ws.close();
          setTimeout(() => {
            expect(onServerClose).toHaveBeenCalled();
            resolve(void 0);
          }, 100);
        };
      });
    });

    it('should send a message and receive a reply', async () => {
      const ws = new WebSocket(url);
      const onOpen = vi.fn(() => {
        ws.send('hello');
      });
      const onMessage = vi.fn((ev) => {
        expect(ev.data).toEqual(JSON.stringify({ data: 'hello' }));
        ws.close();
      });
      await new Promise((resolve) => {
        ws.onopen = onOpen;
        ws.onmessage = onMessage;
        ws.onclose = resolve;
      });
      expect(onOpen).toHaveBeenCalled();
      expect(onMessage).toHaveBeenCalled();
    });
  });
});