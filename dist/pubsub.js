export class PubSub {
    #topics = {};
    #subscriptions = new Map();
    #wildcards = {};
    createSubscriber(handler = () => void 0) {
        return new PubSubSubscriber(handler);
    }
    publish(topic, data) {
        let count = 0;
        if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
            data = JSON.stringify(data);
        }
        if (this.#topics[topic]) {
            for (let subscriber of this.#topics[topic]) {
                try {
                    subscriber.publish(topic, data);
                    count += 1;
                }
                catch (err) {
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
                    }
                    catch (err) {
                        // noop
                    }
                }
            }
        }
        return count;
    }
    subscribe(topic, subscriber) {
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
        }
        else {
            if (!this.#topics[topic]) {
                this.#topics[topic] = new Set();
            }
            this.#topics[topic].add(subscriber);
        }
    }
    unsubscribe(topic, subscriber) {
        const subscriptions = this.#subscriptions.get(subscriber);
        const wildcard = topic.indexOf('*');
        if (wildcard >= 0) {
            const prefix = topic.substring(0, topic.length - 1);
            if (this.#wildcards[prefix]) {
                this.#wildcards[prefix].delete(subscriber);
            }
        }
        else if (this.#topics[topic]) {
            this.#topics[topic].delete(subscriber);
        }
        if (subscriptions) {
            subscriptions.delete(topic);
            if (subscriptions.size === 0) {
                this.#subscriptions.delete(subscriber);
            }
        }
    }
    unsubscribeAll(subscriber) {
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
    #handler;
    constructor(handler) {
        this.#handler = handler;
    }
    publish(topic, data) {
        this.#handler(topic, data);
    }
    stream() {
        return new ReadableStream({
            start: (ctrl) => {
                this.#handler = (topic, data) => {
                    if (data === null) {
                        ctrl.close();
                    }
                    else {
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
