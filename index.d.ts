/**
 * Base class for custom elements that expose a `ready` Promise.
 *
 * Subclasses call `this._resolveReady()` once their async initialization
 * is complete. The `ready` Promise resolves at that point, and a `ready`
 * event is dispatched (bubbles, composed).
 *
 * @example
 * class MyElement extends ReadyElement {
 *   async connectedCallback() {
 *     await this.loadData()
 *     this._resolveReady()
 *   }
 * }
 * customElements.define('my-element', MyElement)
 */
export declare class ReadyElement extends HTMLElement {
  /**
   * A Promise that resolves once `_resolveReady()` has been called.
   * Awaiting this guarantees the element has finished its initialization.
   */
  readonly ready: Promise<void>;

  /**
   * Whether this element has already resolved its ready signal.
   */
  readonly isReady: boolean;

  /**
   * Signal that this element is ready.
   * Idempotent — safe to call multiple times, only resolves once.
   * Dispatches a `ready` event (`bubbles: true, composed: true`).
   */
  protected _resolveReady(): void;
}
