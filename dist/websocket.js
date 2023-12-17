import { PubSubSubscriber } from './pubsub';
export class ExotWebSocket {
    exot;
    raw;
    userData;
    subscriber = new PubSubSubscriber((_topic, data) => {
        this.send(data);
    });
    constructor(exot, raw, userData) {
        this.exot = exot;
        this.raw = raw;
        this.userData = userData;
    }
    close() {
        this.raw.close();
    }
    send(data) {
        if (data !== null) {
            this.raw.send(data);
        }
    }
    publish(topic, data) {
        return this.exot.pubsub.publish(topic, data);
    }
    subscribe(topic) {
        this.exot.pubsub.subscribe(topic, this.subscriber);
    }
    unsubscribe(topic) {
        this.exot.pubsub.unsubscribe(topic, this.subscriber);
    }
    unsubscribeAll() {
        this.exot.pubsub.unsubscribeAll(this.subscriber);
    }
}
