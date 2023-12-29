export class ExotRequest {
    get bodyUsed() {
        return false;
    }
    get cache() {
        return 'default';
    }
    get credentials() {
        return 'omit';
    }
    get destination() {
        return 'document';
    }
    get integrity() {
        return '';
    }
    get mode() {
        return 'same-origin';
    }
    get keepalive() {
        return false;
    }
    get redirect() {
        return 'manual';
    }
    get referrer() {
        return '';
    }
    get referrerPolicy() {
        return 'origin';
    }
    get signal() {
        return new AbortSignal();
    }
}
