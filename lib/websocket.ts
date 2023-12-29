import { Exot } from './exot.js';
import { PubSubSubscriber } from './pubsub.js';

interface WebSocketInterface {
  addEventListener?: (event: string, handler: () => void) => void;
  close: () => void;
  send: (data: ArrayBuffer | Uint8Array | string) => void; 
}

export class ExotWebSocket<RawWebSocket extends WebSocketInterface, UserData = any> {
  readonly subscriber = new PubSubSubscriber((_topic: string, data: ArrayBuffer | Uint8Array | string | null) => {
    this.send(data);
  });

  constructor(readonly exot: Exot, readonly raw: RawWebSocket, readonly userData: UserData = {} as UserData) {
    this.raw.addEventListener?.('close', () => {
      this.unsubscribeAll();
    });
  }

  close() {
    this.raw.close();
  }

  send(data: ArrayBuffer | Uint8Array | string | null) {
    if (data !== null) {
      this.raw.send(data);
    }
  }

  publish(topic: string, data: ArrayBuffer | Uint8Array | string) {
    return this.exot.pubsub.publish(topic, data);
  }

  subscribe(topic: string) {
    this.exot.pubsub.subscribe(topic, this.subscriber);
  }

  unsubscribe(topic: string) {
    this.exot.pubsub.unsubscribe(topic, this.subscriber);
  }

  unsubscribeAll() {
    this.exot.pubsub.unsubscribeAll(this.subscriber);
  }
}
