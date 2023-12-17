import type { PubSubHandler } from './types';

export class PubSub {
  #topics: Record<string, Set<PubSubSubscriber>> = {};

  #subscriptions = new Map<PubSubSubscriber, Set<string>>();

  #wildcards: Record<string, Set<PubSubSubscriber>> = {};

  createSubscriber(handler: PubSubHandler = () => void 0) {
    return new PubSubSubscriber(handler);
  }

  publish(topic: string, data: ArrayBuffer | string): number {
    let count = 0;
    if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
      data = JSON.stringify(data);
    }
    if (this.#topics[topic]) {
      for (let subscriber of this.#topics[topic]) {
        try {
          subscriber.publish(topic, data);
          count += 1;
        } catch (err) {
          // noop
        }
      }
    }
    for (let prefix in this.#wildcards) {
      if (prefix === '' || topic.startsWith(prefix)) {
        for (let subscriber of this.#wildcards[prefix]) {
          try {
            subscriber.publish(topic, data);
            count += 1;
          } catch (err) {
            // noop
          }
        }
      }
    }
    return count;
  }

  subscribe(topic: string, subscriber: PubSubSubscriber) {
    const wildcard = topic.indexOf('*');
    if (wildcard >= 0) {
      if (wildcard !== topic.length - 1) {
        throw new Error('Wildcard subscription must end with an asterisk symbol.');
      }
      const prefix = topic.substring(0, topic.length - 1);
      if (!this.#wildcards[prefix]) {
        this.#wildcards[prefix] = new Set();
      }
      this.#wildcards[prefix].add(subscriber);

    } else {
      if (!this.#topics[topic]) {
        this.#topics[topic] = new Set();
      }
      this.#topics[topic].add(subscriber);
    }
  }

  unsubscribe(topic: string, subscriber: PubSubSubscriber) {
    const subscriptions = this.#subscriptions.get(subscriber);
    const wildcard = topic.indexOf('*');
    if (wildcard >= 0) {
      const prefix = topic.substring(0, topic.length - 1);
      if (this.#wildcards[prefix]) {
        this.#wildcards[prefix].delete(subscriber);
      }
    } else if (this.#topics[topic]) {
      this.#topics[topic].delete(subscriber);
    }
    if (subscriptions) {
      subscriptions.delete(topic);
      if (subscriptions.size === 0) {
        this.#subscriptions.delete(subscriber);
      }
    }
  }

  unsubscribeAll(subscriber: PubSubSubscriber) {
    const subscriptions = this.#subscriptions.get(subscriber);
    if (subscriptions) {
      for (let topic of subscriptions) {
        this.unsubscribe(topic, subscriber);
      }
      this.#subscriptions.delete(subscriber);
    }
  }
}

export class PubSubSubscriber {
  #handler: PubSubHandler;

  constructor(handler: PubSubHandler) {
    this.#handler = handler;
  }

  publish(topic: string, data: ArrayBuffer | string | null) {
    this.#handler(topic, data);
  }

  stream() {
    return new ReadableStream({
      start: (ctrl) => {
        this.#handler = (topic: string, data: ArrayBuffer | string | null) => {
          if (data === null) {
            ctrl.close();
          } else {
            ctrl.enqueue(JSON.stringify({
              topic,
              data,
            }) + '\n');
          }
        };
      },
    });
  }
}
