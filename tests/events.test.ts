import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Events } from '../lib/events.js';
import { Context } from '../lib/context.js';

describe('Events', () => {
  let ctx: Context;
  let events: Events<any>;

  beforeEach(() => {
    events = new Events();
    ctx = new Context({
      req: new Request('http://localhost/', {
        method: 'POST',
      }),
    });
  });

  it('should execute attached listeners', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    events.on('request', listener1);
    events.on('request', listener2);
    await events.emit('request', ctx);
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener1).toHaveBeenCalledWith(ctx);
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledWith(ctx);
  });

  it('should remove a listener', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    events.on('request', listener1);
    events.on('request', listener2);
    events.off('request', listener1);
    await events.emit('request', ctx);
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('should forward events to other instances', async () => {
    const events2 = new Events();
    const events3 = new Events();
    events.forwardTo(events2);
    events2.forwardTo(events3);
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    events.on('request', listener1);
    events2.on('request', listener2);
    events3.on('request', listener3);
    await events.emit('request', ctx);
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener1).toHaveBeenCalledWith(ctx);
    expect(listener2).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledWith(ctx);
    expect(listener3).toHaveBeenCalledOnce();
    expect(listener3).toHaveBeenCalledWith(ctx);
  });
});