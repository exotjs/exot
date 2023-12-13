import { Exot } from '../exot';
export const serverTiming = (options = {}) => {
    const { includeInternal = false, } = options;
    return new Exot({
        name: 'middleware/server-timing',
    })
        .onResponse(({ set, traces }) => {
        const it = (trace) => {
            const internal = trace.name.startsWith('@');
            if (includeInternal || !internal) {
                const name = internal ? trace.name.replace(/[^\w]/g, '_') : trace.name;
                set.headers.append('server-timing', `${name}${trace.desc ? `;desc="${trace.desc}"` : ''};dur=${trace.time}`);
            }
            if (trace.traces.length) {
                trace.traces.forEach(it);
            }
        };
        traces.forEach(it);
    });
};
